function UserlistMaintainer( grmbleChat )
{
    this.grmbleChat = grmbleChat;
    this.types = [ 'join', 'part' ];
    this.priority = 0;
    
    this.HandleMessage = function( msg )
    {
        switch( msg.type )
        {
        case 'part':

            if ( msg.sender.key != this.grmbleChat.account.key ) // don't remove ourselves on our old part messages
            {
                this.grmbleChat.nicknames = this.grmbleChat.nicknames.filter( function( element, index, array ) { return element != ( msg.nickname ? msg.nickname : msg.sender.nickname ); } )
    
                var $removeuser = 'user-' + msg.sender.key;
                $("#" + $removeuser).fadeTo( 'slow', 0.0 );
                $("#" + $removeuser).remove();
            }
            break;
        case 'join':

            // FIXME: these two tests are essentially the same (js array and userlist entry)

            if ( !this.grmbleChat.nicknames.some( function checkElem( element, index, array ) { return ( element == ( msg.nickname ? msg.nickname : msg.sender.nickname ) ); } ) )
            {
                this.grmbleChat.nicknames.push( msg.nickname ? msg.nickname : msg.sender.nickname );
            }
            
            var $adduser = 'user-' + msg.sender.key;
            if ( $("#" + $adduser).length == 0 )
            {
                $('#userlist tr:last').after( this.grmbleChat.templateSystem.render( 'user_list_entry_template', msg.sender ? msg.sender : { 'nickname': msg.nickname } ) );
            }
            break;
        default:
            break;            
        }
    }
}


function GrmbleChat()
{
    var _this = this;

    // private
    var KEY_TAB = 9;

    var userlistUpdateInterval = 1000 * 60;

    var updateInterval_min = 1000;
    var updateInterval_max = 1000 * 60;
    var updateInterval_error = 1000 * 10;
    this.updateInterval = updateInterval_min;
    var message_display_max = 70;
    var timestamp_iso8601_format = 'Y-m-d\TH:i:s';
    var do_polling = true;

    this.room = null;
    this.account = null;
    this.nicknames = [];
    this.templateSystem = null;
    this.url_message_next = '';
    var $chatlog;
    var $text_entry_content;

    var idleTime = 120000; // 2 minutes

    var messageHandlers = {
                                'message': [],
                                'topic': [],
                                'idle': [],
                                'active': [],
                                'join': [],
                                'part': [],
                           };

    this.RegisterHandler = function( handler )
    {
        for( var typeIndex = 0; typeIndex < handler.types.length; ++typeIndex )
        {
            var type = handler.types[ typeIndex ];
            if ( typeof( messageHandlers[ type ] ) != 'undefined' )
            {
                // should we handle re-registration of the same guy?
                messageHandlers[ type ].push( handler );

                function comparePriority( a, b )
                {
                    return b.priority - a.priority;
                }

                messageHandlers[ type ].sort( comparePriority ); // keep handlers sorted
            }
            else
            {
                // emit warning to js console?
            }
        }
    };
    
    this.UnregisterHandler = function( handler )
    {
        for( var typeIndex = 0; typeIndex < handler.types.length; ++typeIndex )
        {
            var type = handler.types[ typeIndex ];
            if ( typeof( messageHandlers[ type ] ) != 'undefined' )
            {
                while( i < messageHandlers[ type ].length )
                {
                    if ( typeof( messageHandlers[ type ][ i ] ) == typeof( handler ) )
                    {
                        messageHandlers.splice( i, 1 );
                    }
                    i++;
                }
            }
        }
    };

    this.Broadcast = function( broadcastMessage )
    {
        if ( typeof( messageHandlers[ broadcastMessage.type ] ) == 'undefined' )
        {
            // emit a warning?
            return;
        }
        
        // handlers are kept sorted by priority when registered
        for ( var handlerIndex = 0; handlerIndex < messageHandlers[ broadcastMessage.type ].length; ++handlerIndex )
        {
            try
            {
                messageHandlers[ broadcastMessage.type ][ handlerIndex ].HandleMessage( broadcastMessage );
            }
            catch( error )
            {
                function getObjectClass( obj )
                {
                    if ( obj && obj.constructor && obj.constructor.toString )
                    {
                        var arr = obj.constructor.toString().match( /function\s*(\w+)/ );

                        if ( arr && arr.length == 2 )
                        {
                            return arr[ 1 ];
                        }
                    }

                    return typeof( obj );
                }

                $('#errorBar').html( 'Error executing handler \'' + getObjectClass( messageHandlers[ broadcastMessage.type ][ handlerIndex ] ) + '\': ' + error );
                $('#errorBar').slideDown( 'fast' );
            }
        }
    };
    
    this.textEntrySubmit = function()
    {
        var msg = $text_entry_content.val();
        if ( msg.length > 0 )
        {
            newMessage = _this.createMessage( 'message', msg );
            _this.sendMessage( newMessage );
            _this.Broadcast( newMessage ); // broadcast it locally so we see it right away, must
                                     // be called after we sendMessage because message may
                                     // be modified during broadcast (formatting, etc.)
            
            $text_entry_content.val('');
            _this.updateInterval = updateInterval_min; // FIXME need to cancel pending update and retrigger it with this new interval
        }
        
        return false;
    }

    this.textEntryKeydown = function( event )
    {
        if ( event.which == KEY_TAB )
        {
            autocompleteUsername( $(event.target), _this.nicknames );
            return false;
        }
    }

    // takes a text field and an array of strings for autocompletion
    function autocompleteUsername( $input, names )
    {
        var value = $input.val();
        var candidates = [];
        var i;

        // ensure we have text, no text is selected, and cursor is at end of text
        if ( value.length > 0 && $input[0].selectionStart == $input[0].selectionEnd && $input[0].selectionStart == value.length)
        {
            // filter names to find only strings that start with existing value
            for ( i = 0; i < names.length; i++)
            {
                if ( names[ i ].toLowerCase().indexOf( value.toLowerCase() ) == 0 && names[ i ].length >= value.length )
                {
                    candidates.push( names[ i ] );
                }
            }
            if ( candidates.length > 0 )
            {
                // some candidates for autocompletion are found
                if ( candidates.length == 1 )
                {
                    $input.val( candidates[0] + ': ' );
                }
                else
                {
                    $input.val( longestInCommon( candidates, value.length ) );
                }
                return true;
            }
        }
        return false;
    }

    this.scrollToBottom = function()
    {
        // trim message list
        var $messages = $chatlog.find('.message:visible');
        if ( $messages.length > message_display_max )
        {
            $messages.slice( 0, $messages.length - message_display_max ).remove();
        }
        // scroll to bottom
        var dest = $('html').attr('scrollHeight') - $('html').attr('clientHeight');
        $('html').scrollTop(dest);
        $('body').scrollTop(dest); // FIXME this is a chromium workaround for bug #2891
    }

    this.createMessage = function( type, messageContent )
    {
       return {
                  'sender': _this.account,
                  'nickname': _this.account.nickname,
                  'timestamp': new Date().getTime(),
                  'content': messageContent,
                  'type': type,
                  'room': _this.room,
                  'key': new Date().getTime()
              };
    }

    this.sendMessage = function( messageToSend )
    {
        function success( data )
        {
            do_polling = true;
            
            response = $.parseJSON( data );
            
            if ( response[ 'response_status' ] == 'OK' )
            {
                responseMessage = response[ 'message' ]

                // rebroadcast it locally so we fix up our temp entry
                _this.Broadcast( responseMessage );
                
                // reset our next url
                _this.url_message_next = response[ 'next' ];
            }
        }

        function error( request, status, error )
        {
            $('#errorBar').html( 'An error has occured sending a message to the server.  You should probably reload.' );
            $('#errorBar').slideDown( 'fast' );
            do_polling = true;
        }

        // FIXME: we should even handle sending to the server with a Handler
        var post_url = '/api/room/' + _this.room.key + '/msg/';
        do_polling = false;
        jsonMessage = $.toJSON( messageToSend )
        $.ajax(
        {
            url: post_url,
            type: 'POST',
            data: { 'message': jsonMessage },
            success: success,
            error: error,
        });
        return false;
    }

    this.updateAccount = function()
    {

        function success( data )
        {
            _this.account = data;
        }

        function error( request, status, error )
        {
            $('#errorBar').html( 'An error has occured refreshing your account information.  You should probably reload.' );
            $('#errorBar').slideDown( 'fast' );
        }

        $.ajax({
            url: '/api/account/' + _this.account.key,
            dataType: 'json',
            success: success,
            error: error,
        });
    }

    this.updateUsers = function()
    {
        function success( data )
        {
            _this.nicknames = [];

            $.each( data, function( index, roomlist )
            {
                _this.nicknames.push( roomlist.account.nickname );

                var $adduser = 'user-' + roomlist.account.key;
                if ( $("#" + $adduser).length == 0 )
                {
                    $('#userlist tr:last').after( _this.templateSystem.render( 'user_list_entry_template', roomlist.account ) );
                    if ( roomlist.status == 'idle' )
                    {
                        $('#userlist tr:last').fadeTo( 'fast', 0.5 );
                    }
                }
            });
        }

        function error( request, status, error )
        {
            $('#errorBar').html( 'An error has occured updating the userlist.  You should probably reload.' );
            $('#errorBar').slideDown( 'fast' );
        }

        $.ajax({
            url: '/api/room/' + _this.room.key + '/users/',
            dataType: 'json',
            success: success,
            error: error,
        });
    }

    this.joinRoom = function()
    {
        function success( data )
        {
            if ( data[ 'response_status' ] == 'OK' )
            {
                // populate our user list
                _this.updateUsers();
            }
            else
            {
                $('#errorBar').html( data[ 'response_status' ] );
                $('#errorBar').slideDown( 'fast' );
            }
        }

        function error( request, status, error )
        {
            $('#errorBar').html( 'An error occurred trying to join the room.  You should probably reload.' );
            $('#errorBar').slideDown( 'fast' );
        }

        $.ajax({
            url: '/api/room/' + _this.room.key + '/join/',
            dataType: 'json',
            type: 'POST',
            success: success,
            error: error,
        });
    }

    this.updateChat = function()
    {
        function success( data )
        {
            if ( !data || !data[ 'messages'] || data[ 'messages' ].length <= 0 )
            {
                // FIXME: we've temporarily changed the backoff from exponential to linear. + 2000 instead of * 2
                _this.updateInterval = Math.min( _this.updateInterval + 2000, updateInterval_max );
                return;
            }

            if ( data[ 'response_status' ] != 'OK' )
            {
                $('#errorBar').html( "Error: '%s'.  We'll keep trying, but you should probably reload." % data[ 'response_status' ] );
                $('#errorBar').slideDown( 'fast' );

                // give the server/network/etc some time to settle before retrying
                _this.updateInterval = updateInterval_error;
                return;
            }

            // FIXME: clear the errorbar?

            for ( messageIndex = 0; messageIndex < data[ 'messages' ].length; ++messageIndex )
            {
                _this.Broadcast( data[ 'messages' ][ messageIndex ] );
            }

            _this.updateInterval = updateInterval_min;
                
            if ( data[ 'next' ] )
            {
                _this.url_message_next = data[ 'next' ];
            }
        }

        function error( request, status, error )
        {
            // give the server/network/etc some time to settle before retrying
            _this.updateInterval = updateInterval_error;

            $('#errorBar').html( 'An error occurred trying to get new messages from the server.  You should probably reload.' );
            $('#errorBar').slideDown( 'fast' );
        }

        $.ajax({
            url: _this.url_message_next,
            dataType: 'json',
            success: success,
            error: error,
        });
    }

    // finds the longest common substring in the given data set.
    // takes an array of strings and a starting index
    function longestInCommon( candidates, index )
    {
        var i, ch, memo;

        do
        {
            memo = null;
            for (i = 0; i < candidates.length; i++)
            {
                ch = candidates[ i ].charAt( index );
            
                if ( !ch )
                {
                    break;
                }
	        
                if ( !memo )
                {
                    memo = ch;
                }
                else if ( ch != memo )
                {
                    break;
                }
            }
        } while ( i == candidates.length && ++index );

        return candidates[ 0 ].slice( 0, index );
    }
    
    this.OnIdle = function()
    {
        _this.sendMessage( _this.createMessage( 'idle', '' ) );
    }
    
    this.OnUnidle = function()
    {
        _this.sendMessage( _this.createMessage( 'active', '' ) );
    }

    this.initialize = function( the_room, the_account )
    {
        // initialize "statics"
        this.room = the_room;
        this.account = the_account;
        this.templateSystem = new TemplateSystem();
        _this.url_message_next = '/api/room/' + this.room.key + '/msg/?since=';
        $chatlog = $('#chatlog');
        $text_entry_content = $('#text-entry-content');

        // apply jquery hooks and behaviors
        $('#room-topic').editable('/api/room/' + this.room.key + '/topic/', {
            indicator   : 'Saving...',
            tooltip     : 'Click to edit',
            name        : 'topic',
            ajaxoptions : { dataType: 'json' },
            callback    : function (value, settings) { $(this).html(value.message) },
        });
        
        // register our default handlers
        this.RegisterHandler( new UserlistMaintainer( this ) );
        this.RegisterHandler( new MessageLinkifier( this ) );
        this.RegisterHandler( new YoutubeHandler( this ) );
        this.RegisterHandler( new TopicHandler( this ) );
        this.RegisterHandler( new IdleNotifications( this ) );
        this.RegisterHandler( new MessageRenderer( this ) );
        this.RegisterHandler( new IdleHandler( this ) );
        this.RegisterHandler( new AudioHandler( this ) );
        this.RegisterHandler( new ImageHandler( this ) );
        this.RegisterHandler( new HighlightMeHandler( this ) );

        // prepare the window for user interaction
        this.scrollToBottom();
        $('#text-entry-content').focus();

        // set up idle timer
        $(document).bind( "idle.idleTimer", this.OnIdle );
        $(document).bind( "active.idleTimer", this.OnUnidle );
        $.idleTimer( idleTime );
    }
    
    return this;
}


// add .format to Date objects -- emulates PHP's date()
// from http://jacwright.com/projects/javascript/date_format
Date.prototype.format=function(format){ format = typeof(format) == 'undefined' ? '' : format;var returnStr='';var replace=Date.replaceChars;for(var i=0;i<format.length;i++){var curChar=format.charAt(i);if(i-1>=0&&format.charAt(i-1)=="\\"){returnStr+=curChar;}else if(replace[curChar]){returnStr+=replace[curChar].call(this);}else if(curChar!="\\"){returnStr+=curChar;}}return returnStr;};Date.replaceChars={shortMonths:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],longMonths:['January','February','March','April','May','June','July','August','September','October','November','December'],shortDays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],longDays:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],d:function(){return(this.getDate()<10?'0':'')+this.getDate();},D:function(){return Date.replaceChars.shortDays[this.getDay()];},j:function(){return this.getDate();},l:function(){return Date.replaceChars.longDays[this.getDay()];},N:function(){return this.getDay()+1;},S:function(){return(this.getDate()%10==1&&this.getDate()!=11?'st':(this.getDate()%10==2&&this.getDate()!=12?'nd':(this.getDate()%10==3&&this.getDate()!=13?'rd':'th')));},w:function(){return this.getDay();},z:function(){var d=new Date(this.getFullYear(),0,1);return Math.ceil((this-d)/86400000);},W:function(){var d=new Date(this.getFullYear(),0,1);return Math.ceil((((this-d)/86400000)+d.getDay()+1)/7);},F:function(){return Date.replaceChars.longMonths[this.getMonth()];},m:function(){return(this.getMonth()<9?'0':'')+(this.getMonth()+1);},M:function(){return Date.replaceChars.shortMonths[this.getMonth()];},n:function(){return this.getMonth()+1;},t:function(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),0).getDate()},L:function(){var year=this.getFullYear();return(year%400==0||(year%100!=0&&year%4==0));},o:function(){var d=new Date(this.valueOf());d.setDate(d.getDate()-((this.getDay()+6)%7)+3);return d.getFullYear();},Y:function(){return this.getFullYear();},y:function(){return(''+this.getFullYear()).substr(2);},a:function(){return this.getHours()<12?'am':'pm';},A:function(){return this.getHours()<12?'AM':'PM';},B:function(){return Math.floor((((this.getUTCHours()+1)%24)+this.getUTCMinutes()/60+this.getUTCSeconds()/3600)*1000/24);},g:function(){return this.getHours()%12||12;},G:function(){return this.getHours();},h:function(){return((this.getHours()%12||12)<10?'0':'')+(this.getHours()%12||12);},H:function(){return(this.getHours()<10?'0':'')+this.getHours();},i:function(){return(this.getMinutes()<10?'0':'')+this.getMinutes();},s:function(){return(this.getSeconds()<10?'0':'')+this.getSeconds();},u:function(){var m=this.getMilliseconds();return(m<10?'00':(m<100?'0':''))+m;},e:function(){return"Not Yet Supported";},I:function(){return"Not Yet Supported";},O:function(){return(-this.getTimezoneOffset()<0?'-':'+')+(Math.abs(this.getTimezoneOffset()/60)<10?'0':'')+(Math.abs(this.getTimezoneOffset()/60))+'00';},P:function(){return(-this.getTimezoneOffset()<0?'-':'+')+(Math.abs(this.getTimezoneOffset()/60)<10?'0':'')+(Math.abs(this.getTimezoneOffset()/60))+':00';},T:function(){var m=this.getMonth();this.setMonth(0);var result=this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/,'$1');this.setMonth(m);return result;},Z:function(){return-this.getTimezoneOffset()*60;},c:function(){return this.format("Y-m-d\\TH:i:sP");},r:function(){return this.toString();},U:function(){return this.getTime()/1000;}};

var g_GrmbleChat = null;

function UpdateChat()
{
    g_GrmbleChat.updateChat();

    if ( g_GrmbleChat.updateInterval > 0 )
    {
        setTimeout( UpdateChat, g_GrmbleChat.updateInterval );
    }
}

StartChat = function( room, account )
{
    g_GrmbleChat = new GrmbleChat();
    g_GrmbleChat.initialize( room, account );
    $('#text-entry').submit( g_GrmbleChat.textEntrySubmit ).keydown( g_GrmbleChat.textEntryKeydown );
    g_GrmbleChat.joinRoom();
    setTimeout( UpdateChat, g_GrmbleChat.updateInterval );
}