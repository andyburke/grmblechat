
function GrmbleChat()
{
    // private
    var userlistUpdateInterval = 1000 * 60;

    var updateInterval_min = 1000;
    var updateInterval_max = 1000 * 60;
    var updateInterval_error = 1000 * 10;
    var updateInterval = updateInterval_min;
    var message_display_max = 70;
    var timestamp_iso8601_format = 'Y-m-d\TH:i:s';
    var do_polling = true;

    var room = null;
    var account = null;
    var nicknames = [];
    var templateSystem = null;
    var url_message_next = '';
    var $chatlog;

    var m_Busy = false;
    var m_GotInitialChatBundle = false;

    var messageHandlers = {
                                'message': [],
                                'topic': [],
                                'idle': [],
                                'active': [],
                                'join': [],
                                'part': [],
                           };

    this.GetNicknames = function() { return nicknames; }
    this.GetUpdateInterval = function() { return updateInterval; }
    this.GetTemplateSystem = function() { return templateSystem; }
    this.GetAccount = function() { return account; }
    this.GetRoom = function() { return room; }

    this.RemoveNickname = function( nickname )
    {
        nicknames = nicknames.filter( function( element, index, array ) { return element != nickname; } );
    }

    this.AddNickname = function( nickname )
    {
        if ( !nicknames.some( function( element, index, array ) { return element == nickname; } ) )
        {
            nicknames.push( nickname );
        }
    }

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

    function Error( message )
    {
        $('#errorBarContent').html( message );
        $('#errorBar').slideDown( 'fast' );
    }

    function Broadcast( broadcastMessage )
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

                Error( 'Error executing handler \'' + getObjectClass( messageHandlers[ broadcastMessage.type ][ handlerIndex ] ) + '\': ' + error );
            }
        }
    };
    
    this.ScrollToBottom = function()
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

    function CreateMessage( type, messageContent )
    {
       return {
                  'sender': account,
                  'nickname': account.nickname,
                  'timestamp': new Date().getTime(),
                  'content': messageContent,
                  'type': type,
                  'room': room,
                  'key': new Date().getTime()
              };
    }

    this.CreateAndSendMessage = function( type, content )
    {
        newMessage = CreateMessage( type, content );
        SendMessage( newMessage );
        Broadcast( newMessage ); // broadcast it locally so we see it right away, must
                                 // be called after we SendMessage because message may
                                 // be modified during broadcast (formatting, etc.)
        updateInterval = updateInterval_min; // FIXME need to cancel pending update and retrigger it with this new interval
    }

    function SendMessage( messageToSend )
    {
        function success( data )
        {
            do_polling = true;
            
            response = $.parseJSON( data );
            
            if ( response[ 'response_status' ] == 'OK' )
            {
                responseMessage = response[ 'message' ]

                // rebroadcast it locally so we fix up our temp entry
                Broadcast( responseMessage );
            }

            m_Busy = false;
        }

        function error( request, status, error )
        {
            Error( 'An error has occured sending a message to the server.  You should probably reload.' );
            do_polling = true;
            m_Busy = false;
        }

        m_Busy = true;

        // FIXME: we should even handle sending to the server with a Handler
        var post_url = '/api/room/' + room.key + '/msg/';
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

    function UpdateAccount()
    {
        function success( data )
        {
            account = data;
            m_Busy = false;
        }

        function error( request, status, error )
        {
            Error( 'An error has occured refreshing your account information.  You should probably reload.' );
            m_Busy = false;
        }

        m_Busy = true;
        $.ajax({
            url: '/api/account/' + account.key,
            dataType: 'json',
            success: success,
            error: error,
        });
    }

    function UpdateUsers()
    {
        function success( data )
        {
            nicknames = [];

            $("#userlist").find("tr:gt(0)").remove();
            
            $.each( data, function( index, roomlist )
            {
                nicknames.push( roomlist.account.nickname );

                var $adduser = 'user-' + roomlist.account.key;
                if ( $("#" + $adduser).length == 0 )
                {
                    $('#userlist tr:last').after( templateSystem.render( 'user_list_entry_template', roomlist.account ) );
                    if ( roomlist.status == 'idle' )
                    {
                        $('#userlist tr:last').fadeTo( 'fast', 0.5 );
                    }
                }
            });

            m_Busy = false;
        }

        function error( request, status, error )
        {
            Error( 'An error has occured updating the userlist.  You should probably reload.' );
            m_Busy = false;
        }

        m_Busy = true;
        $.ajax({
            url: '/api/room/' + room.key + '/users/',
            dataType: 'json',
            success: success,
            error: error,
        });
    }

    function JoinRoom()
    {

        function success( data )
        {
            if ( data[ 'response_status' ] != 'OK' )
            {
                Error( data[ 'response_status' ] );
            }
            m_Busy = false;
        }

        function error( request, status, error )
        {
            Error( 'An error occurred trying to join the room.  You should probably reload.' );
            m_Busy = false;
        }

        m_Busy = true;
        $.ajax({
            url: '/api/room/' + room.key + '/join/',
            dataType: 'json',
            type: 'POST',
            success: success,
            error: error,
        });
    }

    function UpdateChat()
    {

        function success( data )
        {
            if ( data && data[ 'next' ] )
            {
                url_message_next = data[ 'next' ];
            }

            if ( !data || !data[ 'messages'] || data[ 'messages' ].length <= 0 )
            {
                // FIXME: we've temporarily changed the backoff from exponential to linear. + 2000 instead of * 2
                updateInterval = Math.min( updateInterval + 2000, updateInterval_max );
                m_Busy = false;
                return;
            }

            if ( data[ 'response_status' ] != 'OK' )
            {
                Error( "Error: '%s'.  We'll keep trying, but you should probably reload." % data[ 'response_status' ] );

                // give the server/network/etc some time to settle before retrying
                updateInterval = updateInterval_error;
                m_Busy = false;
                return;
            }

            // FIXME: clear the errorbar?

            for ( messageIndex = 0; messageIndex < data[ 'messages' ].length; ++messageIndex )
            {
                Broadcast( data[ 'messages' ][ messageIndex ] );
            }

            updateInterval = updateInterval_min;

            if ( !m_GotInitialChatBundle )
            {
                // we update the userlist again to clear out any 'dead joins'
                UpdateUsers();
                m_GotInitialChatBundle = true;
            }

            m_Busy = false;
        }

        function error( request, status, error )
        {
            // give the server/network/etc some time to settle before retrying
            updateInterval = updateInterval_error;

            Error( 'An error occurred trying to get new messages from the server.  You should probably reload.' );
            m_Busy = false;
        }

        m_Busy = true;
        $.ajax({
            url: url_message_next,
            dataType: 'json',
            success: success,
            error: error,
        });
    }
 
    function Loop()
    {
        if ( !m_Busy )
        {
            UpdateChat();
        }

        if ( updateInterval > 0 )
        {
            setTimeout( Loop, updateInterval );
        }
    }
    
    this.Start = function()
    {
        JoinRoom();
        UpdateChat(); // will call UpdateUsers the first time through
        Loop();
    }

    this.initialize = function( the_room, the_account )
    {
        // initialize "statics"
        room = the_room;
        account = the_account;
        templateSystem = new TemplateSystem();
        url_message_next = '/api/room/' + room.key + '/msg/?since=';
        $chatlog = $('#chatlog');

        // apply jquery hooks and behaviors
        $('#room-topic').editable('/api/room/' + room.key + '/topic/', {
            indicator   : 'Saving...',
            tooltip     : 'Click to edit',
            name        : 'topic',
            ajaxoptions : { dataType: 'json' },
            callback    : function (value, settings) { $(this).html(value.message) },
        });
        
        // register our default handlers
        this.RegisterHandler( new UserlistMaintainer( this ) );
        this.RegisterHandler( new MessageLinkFinder( this ) );
        this.RegisterHandler( new MessageLinkifier( this ) );
        this.RegisterHandler( new YoutubeHandler( this ) );
        this.RegisterHandler( new TopicHandler( this ) );
        this.RegisterHandler( new IdleNotifications( this ) );
        this.RegisterHandler( new MessageRenderer( this ) );
        this.RegisterHandler( new IdleHandler( this ) );
        this.RegisterHandler( new AudioHandler( this ) );
        this.RegisterHandler( new ImageHandler( this ) );
        this.RegisterHandler( new HighlightMeHandler( this ) );
        this.RegisterHandler( new FancyBoxer( this ) );
    }
    
    return this;
}


// add .format to Date objects -- emulates PHP's date()
// from http://jacwright.com/projects/javascript/date_format
Date.prototype.format=function(format){ format = typeof(format) == 'undefined' ? '' : format;var returnStr='';var replace=Date.replaceChars;for(var i=0;i<format.length;i++){var curChar=format.charAt(i);if(i-1>=0&&format.charAt(i-1)=="\\"){returnStr+=curChar;}else if(replace[curChar]){returnStr+=replace[curChar].call(this);}else if(curChar!="\\"){returnStr+=curChar;}}return returnStr;};Date.replaceChars={shortMonths:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],longMonths:['January','February','March','April','May','June','July','August','September','October','November','December'],shortDays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],longDays:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],d:function(){return(this.getDate()<10?'0':'')+this.getDate();},D:function(){return Date.replaceChars.shortDays[this.getDay()];},j:function(){return this.getDate();},l:function(){return Date.replaceChars.longDays[this.getDay()];},N:function(){return this.getDay()+1;},S:function(){return(this.getDate()%10==1&&this.getDate()!=11?'st':(this.getDate()%10==2&&this.getDate()!=12?'nd':(this.getDate()%10==3&&this.getDate()!=13?'rd':'th')));},w:function(){return this.getDay();},z:function(){var d=new Date(this.getFullYear(),0,1);return Math.ceil((this-d)/86400000);},W:function(){var d=new Date(this.getFullYear(),0,1);return Math.ceil((((this-d)/86400000)+d.getDay()+1)/7);},F:function(){return Date.replaceChars.longMonths[this.getMonth()];},m:function(){return(this.getMonth()<9?'0':'')+(this.getMonth()+1);},M:function(){return Date.replaceChars.shortMonths[this.getMonth()];},n:function(){return this.getMonth()+1;},t:function(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),0).getDate()},L:function(){var year=this.getFullYear();return(year%400==0||(year%100!=0&&year%4==0));},o:function(){var d=new Date(this.valueOf());d.setDate(d.getDate()-((this.getDay()+6)%7)+3);return d.getFullYear();},Y:function(){return this.getFullYear();},y:function(){return(''+this.getFullYear()).substr(2);},a:function(){return this.getHours()<12?'am':'pm';},A:function(){return this.getHours()<12?'AM':'PM';},B:function(){return Math.floor((((this.getUTCHours()+1)%24)+this.getUTCMinutes()/60+this.getUTCSeconds()/3600)*1000/24);},g:function(){return this.getHours()%12||12;},G:function(){return this.getHours();},h:function(){return((this.getHours()%12||12)<10?'0':'')+(this.getHours()%12||12);},H:function(){return(this.getHours()<10?'0':'')+this.getHours();},i:function(){return(this.getMinutes()<10?'0':'')+this.getMinutes();},s:function(){return(this.getSeconds()<10?'0':'')+this.getSeconds();},u:function(){var m=this.getMilliseconds();return(m<10?'00':(m<100?'0':''))+m;},e:function(){return"Not Yet Supported";},I:function(){return"Not Yet Supported";},O:function(){return(-this.getTimezoneOffset()<0?'-':'+')+(Math.abs(this.getTimezoneOffset()/60)<10?'0':'')+(Math.abs(this.getTimezoneOffset()/60))+'00';},P:function(){return(-this.getTimezoneOffset()<0?'-':'+')+(Math.abs(this.getTimezoneOffset()/60)<10?'0':'')+(Math.abs(this.getTimezoneOffset()/60))+':00';},T:function(){var m=this.getMonth();this.setMonth(0);var result=this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/,'$1');this.setMonth(m);return result;},Z:function(){return-this.getTimezoneOffset()*60;},c:function(){return this.format("Y-m-d\\TH:i:sP");},r:function(){return this.toString();},U:function(){return this.getTime()/1000;}};

var g_GrmbleChat = null;

function OnIdle()
{
    g_GrmbleChat.CreateAndSendMessage( 'idle', '' );
}
    
function OnUnidle()
{
    g_GrmbleChat.CreateAndSendMessage( 'active', '' );
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

var g_MessageHistory = [];
var g_MessageHistoryOffset = 0;
var g_MessageHistorySize = 100;
var g_MessageHistoryPartialEntry = '';

function textEntrySubmit()
{
    var msg = $('#text-entry-content').val();
    if ( msg.length > 0 )
    {
        g_MessageHistoryPartialEntry = '';
        g_MessageHistory.push( msg );

        while( g_MessageHistory.length > g_MessageHistorySize )
        {
            g_MessageHistory.shift();
        }

        g_GrmbleChat.CreateAndSendMessage( 'message', msg );        
        $('#text-entry-content').val('');
    }
    
    return false;
}

function textEntryKeydown( event )
{
    var KEY_TAB = 9;
    var KEY_ENTER = 13;
    var KEY_UP = 38;
    var KEY_DOWN = 40;

    if ( event.which == KEY_TAB )
    {
        autocompleteUsername( $(event.target), g_GrmbleChat.GetNicknames() );
        return false;
    }
    else if ( event.which == KEY_ENTER && !event.shiftKey )
    {
        textEntrySubmit();
        return false;
    }
    else if ( event.ctrlKey )
    {
        if ( event.which == KEY_UP )
        {
            if ( g_MessageHistory.length > 0 )
            {
                if ( g_MessageHistoryOffset == 0 )
                {
                    g_MessageHistoryPartialEntry = $('#text-entry-content').val();   
                }

                g_MessageHistoryOffset = ++g_MessageHistoryOffset > g_MessageHistory.length ? g_MessageHistory.length : g_MessageHistoryOffset;
                $('#text-entry-content').val( g_MessageHistory[ g_MessageHistory.length - g_MessageHistoryOffset ] );
            }
            return false;
        }
        else if ( event.which == KEY_DOWN )
        {
            if ( g_MessageHistory.length > 0 )
            {
                if ( g_MessageHistoryOffset > 1 )
                {
                    --g_MessageHistoryOffset;
                    $('#text-entry-content').val( g_MessageHistory[ g_MessageHistory.length - g_MessageHistoryOffset ] );
                }
                else if ( g_MessageHistoryOffset > 0 )
                {
                    --g_MessageHistoryOffset;
                    $('#text-entry-content').val( g_MessageHistoryPartialEntry );
                }
            }
            return false;
        }
    }
}

StartChat = function( room, account )
{
    $('#text-entry').submit( textEntrySubmit ).keydown( textEntryKeydown );

    // set up idle timer
    $(document).bind( "idle.idleTimer", OnIdle );
    $(document).bind( "active.idleTimer", OnUnidle );
    $.idleTimer( 1000 * 60 * 2 ); // 2 minutes


    g_GrmbleChat = new GrmbleChat();
    g_GrmbleChat.initialize( room, account );

    // prepare the window for user interaction
    g_GrmbleChat.ScrollToBottom();
    $('#text-entry-content').focus();

    // start the update loop
    g_GrmbleChat.Start();
}