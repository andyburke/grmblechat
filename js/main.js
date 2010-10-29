// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
var TemplateSystem = function()
{
  var cache = {};
  
  this.render = function( str, data )
  {
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !( /\W/.test( str ) ) ?
      cache[str] = cache[str] ||
        this.render( document.getElementById(str).innerHTML ) :
      
      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      new Function("obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};" +
        
        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +
        
        // Convert the template into pure JavaScript
        str.replace(/[\r\t\n]/g, " ").split("<%").join("\t").replace(/((^|%>)[^\t]*)'/g, "$1\r").replace(/\t=(.*?)%>/g, "',$1,'").split("\t").join("');").split("%>").join("p.push('").split("\r").join("\\'") + "');}return p.join('');"
      );
    
    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
};

var HighlightMeHandler = function()
{
    this.types = [ 'message' ];
    this.priority = -101;
    
    this.HandleMessage = function( msg )
    {
        var messages = $(".msg-content:contains('" + chat.account.nickname + "')").add(".msg-content:contains('" + chat.account.nickname.toLowerCase() + "')");

        messages.css({
        '-moz-box-shadow': '2px #44A',
        '-webkit-box-shadow': '2px #44A',
        'background-color': '#DDF'
        });        
    };
};

var MessageLinkifier = function()
{
    this.types = [ 'message' ];
    this.priority = 0;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.rawHTML )
        {
            return;
        }

        msg.content = linkify( msg.content );
        msg.rawHTML = true;
    };
};

var ImageHandler = function()
{
    this.types = [ 'message' ];
    this.priority = 10;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.rawHTML )
        {
            return;
        }
        
        var image = msg.content.match( /(https?:\/\/.*?(png|jpg|gif))(?:\W|$)/ig );
        if ( image && image.length )
        {
            $.each( image, function( i )
            {
                msg.content = msg.content.replace( this, '<img src="' + this + '">' );
            });
            
            msg.rawHTML = true;
        }
    };
};

var AudioHandler = function()
{
    this.types = [ 'message' ];
    this.priority = 10;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.rawHTML )
        {
            return;
        }
        
        var audio = msg.content.match( /(https?:\/\/.*?mp3)(?:\W|$)/ig );
        if ( audio && audio.length )
        {
            $.each( audio, function( i )
            {
                msg.content = msg.content.replace( this, '<p id="audioplayer_' + msg.key + '">' + this +'</p><script type="text/javascript"> AudioPlayer.embed("audioplayer_' + msg.key +'", {soundFile: "' + this +'"});</script>' );
            });
            
            msg.rawHTML = true;
        }
    };
};

var YoutubeHandler = function()
{
    this.types = [ 'message' ];
    this.priority = 100;

    // via stackoverflow
    var vidWidth = 480;
    var vidHeight = 360;
   
    // Tthis could be done by creating an object, adding attributes & inserting parameters, but this is quicker
    var e1 = '<obj'+'ect width="' + vidWidth + '" height="' + vidHeight + '"><param name="movie" value="http://www.youtube.com/v/';
    var e2 = '&hl=en&fs=1"></param><param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param><embed src="http://www.youtube.com/v/';
    var e3 = '&hl=en&fs=1" type="application/x-shockwave-flash" allowscriptaccess="always" allowfullscreen="true" width="' + vidWidth + '" ' + 'height="' + vidHeight + '"></embed></object> ';

    this.HandleMessage = function( msg )
    {
        if ( msg.rawHTML )
        {
            return;
        }
        
        var vid = msg.content.match(/((\?v=)(\w[\w|-]*))/g); // end up with ?v=oHg5SJYRHA0
        if ( vid && vid.length )
        {
            $.each( vid, function(i) {
                var ytid = this.replace(/\?v=/,'') // end up with oHg5SJYRHA0
                msg.content = e1 + ytid + e2 + ytid + e3;
                msg.rawHTML = true;
            })
        }
    };
};

var TopicHandler = function()
{
    this.types = [ 'topic' ];
    this.priority = 0;
    
    this.HandleMessage = function( msg )
    {
        chat.room.topic = msg.content;
        document.title = chat.room.name + ': ' + chat.room.topic;
        $('#room-topic').text( msg.content );

        // are these synchronous?  if so, this isn't good to do this way
        $('#room-topic').fadeTo( 'slow', 0.2 );
        $('#room-topic').fadeTo( 'slow', 1.0 );
    };
};

var IdleNotifications = function()
{
    this.types = [ 'message', 'idle', 'active' ];
    this.priority = 0;
    
    var faviconUrl = '/images/grmblechat.png';
    var minTimeBetweenSoundPlays = 5000; // 5 seconds
    var isIdle = false;
    var missedMessageCount = 0;
    var lastSoundPlayTime = new Date();
    
    this.HandleMessage = function( msg )
    {
        switch( msg.type )
        {
        case 'idle':
            if ( msg.sender.key == chat.account.key )
            {
                isIdle = true;
            }
            break;
        case 'active':
            if ( msg.sender.key == chat.account.key )
            {
                isIdle = false;
                missedMessageCount = 0;
                document.title = chat.room.name + ': ' + chat.room.topic;
                document.getElementById( 'favicon' ).href = faviconUrl;
            }
            break;
        case 'message':
        default:
            if ( isIdle )
            {
                var now = new Date();
                if ( now - lastSoundPlayTime > minTimeBetweenSoundPlays )
                {
                    $.sound.play( '/sounds/message.wav' );
                    lastSoundPlayTime = now;
                }
                ++missedMessageCount;
                document.title = '(' + missedMessageCount + ') ' + chat.room.name + ': ' + chat.room.topic;
                
                // redraw favicon
                var canvas = document.createElement('canvas')
                var ctx;
                var img = document.createElement('img');

                if ( canvas.getContext )
                {
                    canvas.height = canvas.width = 16; // set the size to the favicon default
                    ctx = canvas.getContext( '2d' );
                    img.onload = function ()
                    { // once the image has loaded
                        ctx.drawImage( this, 0, 0 );
                        ctx.font = 'bold 9px "verdana", sans-serif';
                        ctx.fillStyle = '#FF0000';
                        ctx.fillText( missedMessageCount < 10 ? '0' + missedMessageCount : missedMessageCount, 2, 11 );
                        document.getElementById( 'favicon' ).href = canvas.toDataURL('image/png');
                    };
                    img.src = faviconUrl;
                }
                
            }
            break;
        }
    };
};

var MessageRenderer = function()
{
    this.types = [ 'message', 'join', 'part' ];
    this.priority = -100;
    this.templateSystem = new TemplateSystem();
    
    var timestamp_display_format = 'g:i&\\n\\b\\s\\p;A';
    
    this.HandleMessage = function( msg )
    {
        msg.content = ( typeof( msg.content ) == 'undefined' || msg.content == null ) ? '' : ( msg.rawHTML ? msg.content : htmlEscape( msg.content ) );
        msg.friendlyTimestamp = new Date( msg.timestamp ).format( timestamp_display_format );

        var render = true;
        
        switch( msg.type )
        {
        case 'message':
            var $existingLocalMessage = $('#message-' + msg.clientKey );
            var $existingMessage = $('#message-' + msg.key );
            if ( $existingLocalMessage.length != 0 )
            {
                $existingLocalMessage.attr( "id", "message-" + msg.key );
                $existingLocalMessage.find('.msg-content').html( msg.content ); // i guess in case the server does something to our content?
                render = false;
            }
            else if ( $existingMessage.length != 0 )
            {
                $existingMessage.attr( "id", "message-" + msg.key );
                $existingMessage.find('.msg-content').html( msg.content ); // i guess in case the server does something to our content?
                render = false;
            }
            break;
        case 'part':
            if ( msg.sender.key != chat.account.key ) // don't remove ourselves on our old part messages
            {
                var $removeuser = 'user-' + msg.sender.key;
                $("#" + $removeuser).fadeTo( 'slow', 0.0 );
                $("#" + $removeuser).remove();
            }
            break;
        case 'join':
            var $adduser = 'user-' + msg.sender.key;
            if ( $("#" + $adduser).length == 0 )
            {
                $('#userlist tr:last').after( this.templateSystem.render( 'user_list_entry_template', msg ) );
            }
            break;
        default:
            break;
        }
        
        if ( render )
        {
            html = this.templateSystem.render( 'message_template', msg );
            lastRow = $( '#chatlog tr:last' )
            if ( lastRow.length != 0 )
            {
                lastRow.after( html );
            }
            else // we have no messages yet
            {
                $( '#chatlog' ).append( html );
            }
        }
        
        // FIXME: shouldn't do this if the user has scrolled the page, instead we should show that there are new messages somehow
        chat.scrollToBottom();
    };
};

var IdleHandler = function()
{
    this.types = [ 'idle', 'active' ];
    this.priority = 0;
    
    this.HandleMessage = function( msg )
    {
        var $userlistEntry = $( '#user-' + msg.sender.key );
        if ( $userlistEntry.length > 0 )
        {
            switch( msg.type )
            {
            case 'idle':
                $userlistEntry.fadeTo( 'slow', 0.5 );
                break;
            case 'active':
            default:
                $userlistEntry.fadeTo( 'slow', 1.0 );
                break;
            }
        }
    };
};

var chat = function() {

    // private
    var KEY_TAB = 9;

    var update_interval_min = 1000;
    var update_interval_max = 1000 * 60;
    var update_interval_error = 1000 * 10;
    var update_interval = update_interval_min;
    var message_display_max = 70;
    var timestamp_iso8601_format = 'Y-m-d\TH:i:s';
    var do_polling = true;

    this.room = null;
    this.account = null;
    var url_message_next;
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
            messageHandlers[ broadcastMessage.type ][ handlerIndex ].HandleMessage( broadcastMessage );
        }
    };
    
    this.textEntrySubmit = function()
    {
        var msg = $text_entry_content.val();
        if ( msg.length > 0 )
        {
            newMessage = createMessage( 'message', msg );
            sendMessage( newMessage );
            Broadcast( newMessage ); // broadcast it locally so we see it right away, must
                                     // be called after we sendMessage because message may
                                     // be modified during broadcast (formatting, etc.)
            
            $text_entry_content.val('');
            update_interval = update_interval_min; // FIXME need to cancel pending update and retrigger it with this new interval
        }
        
        return false;
    }

    function textEntryKeydown( event )
    {
        if ( event.which == KEY_TAB )
        {
            // FIXME: this is an ass way to get the user list
            var userlist = $('#userlist span').map( function() { return this.id.substr( 10 ) } );
            autocompleteUsername( $(event.target), userlist );
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

    function createMessage( type, messageContent )
    {
       return {
                  'sender': account,
                  'timestamp': new Date().getTime(),
                  'content': messageContent,
                  'type': type,
                  'room': room,
                  'key': new Date().getTime()
              };
    }

    function sendMessage( messageToSend )
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
                
                // reset our last message seen
                chat.lastMessageId = responseMessage.key;
            }
        }

        function error()
        {
            alert( 'failure' );
            do_polling = true;
        }

        // FIXME: we should even handle sending to the server with a Handler
        var post_url = '/api/room/' + room.key + '/msg/';
        do_polling = false;
        jsonMessage = $.toJSON( messageToSend )
        $.ajax(
        {
            url: post_url,
            type: "POST",
            data: { 'message': jsonMessage },
            success: success,
            error: error,
        });
        return false;
    }

    function updateChat()
    {

        function success( data )
        {
            if ( data.messages )
            {
                $.each( data.messages, function( index, message )
                {
                    Broadcast( message );
                    chat.lastMessageId = message.key;
                });
                update_interval = update_interval_min;
            } else {
                // FIXME: we've temporarily changed the backoff from exponential to linear. + 2000 instead of * 2
                update_interval = Math.min(update_interval + 2000, update_interval_max);
            }
            setTimeout(updateChat, update_interval);
        }

        function error( request, status, error )
        {
            // give the server/network/etc some time to settle before retrying
            update_interval = update_interval_error;
            setTimeout( updateChat, update_interval );
            // TODO inform the user about the problem
        }

        $.ajax({
            url: url_message_next + this.lastMessageId,
            dataType: 'json',
            success: success,
            error: error,
        });
    }

    function parseDate( str )
    {
        /* From http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/
        Parses an ISO8601-formated date in UTC, i.e. yyyy-mm-ddThh:mm:ss.ssssss . */
            
        var parts = str.split('T'),
        dateParts = parts[0].split('-'),
        timeParts = parts[1].split(':'),
        timeSecParts = timeParts[2].split('.'),
        timeHours = Number(timeParts[0]),
        date = new Date;

        date.setUTCFullYear(Number(dateParts[0]));
        date.setUTCMonth(Number(dateParts[1])-1);
        date.setUTCDate(Number(dateParts[2]));
        date.setUTCHours(Number(timeHours));
        date.setUTCMinutes(Number(timeParts[1]));
        date.setUTCSeconds(Number(timeSecParts[0]));
        if (timeSecParts[1]) {
            date.setUTCMilliseconds(Math.round(Number(timeSecParts[1])/1000));
        }

        // by using setUTC methods the date has already been converted to local time
        return date;
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
    
    function OnIdle()
    {
        sendMessage( createMessage( 'idle', '' ) );
    }
    
    function OnUnidle()
    {
        sendMessage( createMessage( 'active', '' ) );
    }

    this.initialize = function( the_room, the_account )
    {
        // initialize "statics"
        this.room = the_room;
        this.account = the_account;
        this.lastMessageId = '';
        url_message_next = '/api/room/' + this.room.key + '/msg/?since=';
        $chatlog = $('#chatlog');
        $text_entry_content = $('#text-entry-content');

        // apply jquery hooks and behaviors
        $('#room-topic').editable('/api/room/' + this.room.key + '/topic', {
            indicator   : 'Saving...',
            tooltip     : 'Click to edit',
            name        : 'topic',
            ajaxoptions : { dataType: 'json' },
            callback    : function (value, settings) { $(this).html(value.message) },
        });
        
        $('#text-entry').submit( textEntrySubmit ).keydown( textEntryKeydown );

        // register our default handlers
        RegisterHandler( new MessageLinkifier() );
        RegisterHandler( new YoutubeHandler() );
        RegisterHandler( new TopicHandler() );
        RegisterHandler( new IdleNotifications() );
        RegisterHandler( new MessageRenderer() );
        RegisterHandler( new IdleHandler() );
        RegisterHandler( new AudioHandler() );
        RegisterHandler( new ImageHandler() );
        RegisterHandler( new HighlightMeHandler() );

        // prepare the window for user interaction
        scrollToBottom();
        $('#text-entry-content').focus();

        // set up idle timer
        $(document).bind( "idle.idleTimer", OnIdle );
        $(document).bind( "active.idleTimer", OnUnidle );
        $.idleTimer( idleTime );

        // start the update loop rolling
        setTimeout( updateChat );
    }
    
    return this;
}();


// add .format to Date objects -- emulates PHP's date()
// from http://jacwright.com/projects/javascript/date_format
Date.prototype.format=function(format){ format = typeof(format) == 'undefined' ? '' : format;var returnStr='';var replace=Date.replaceChars;for(var i=0;i<format.length;i++){var curChar=format.charAt(i);if(i-1>=0&&format.charAt(i-1)=="\\"){returnStr+=curChar;}else if(replace[curChar]){returnStr+=replace[curChar].call(this);}else if(curChar!="\\"){returnStr+=curChar;}}return returnStr;};Date.replaceChars={shortMonths:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],longMonths:['January','February','March','April','May','June','July','August','September','October','November','December'],shortDays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],longDays:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],d:function(){return(this.getDate()<10?'0':'')+this.getDate();},D:function(){return Date.replaceChars.shortDays[this.getDay()];},j:function(){return this.getDate();},l:function(){return Date.replaceChars.longDays[this.getDay()];},N:function(){return this.getDay()+1;},S:function(){return(this.getDate()%10==1&&this.getDate()!=11?'st':(this.getDate()%10==2&&this.getDate()!=12?'nd':(this.getDate()%10==3&&this.getDate()!=13?'rd':'th')));},w:function(){return this.getDay();},z:function(){var d=new Date(this.getFullYear(),0,1);return Math.ceil((this-d)/86400000);},W:function(){var d=new Date(this.getFullYear(),0,1);return Math.ceil((((this-d)/86400000)+d.getDay()+1)/7);},F:function(){return Date.replaceChars.longMonths[this.getMonth()];},m:function(){return(this.getMonth()<9?'0':'')+(this.getMonth()+1);},M:function(){return Date.replaceChars.shortMonths[this.getMonth()];},n:function(){return this.getMonth()+1;},t:function(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),0).getDate()},L:function(){var year=this.getFullYear();return(year%400==0||(year%100!=0&&year%4==0));},o:function(){var d=new Date(this.valueOf());d.setDate(d.getDate()-((this.getDay()+6)%7)+3);return d.getFullYear();},Y:function(){return this.getFullYear();},y:function(){return(''+this.getFullYear()).substr(2);},a:function(){return this.getHours()<12?'am':'pm';},A:function(){return this.getHours()<12?'AM':'PM';},B:function(){return Math.floor((((this.getUTCHours()+1)%24)+this.getUTCMinutes()/60+this.getUTCSeconds()/3600)*1000/24);},g:function(){return this.getHours()%12||12;},G:function(){return this.getHours();},h:function(){return((this.getHours()%12||12)<10?'0':'')+(this.getHours()%12||12);},H:function(){return(this.getHours()<10?'0':'')+this.getHours();},i:function(){return(this.getMinutes()<10?'0':'')+this.getMinutes();},s:function(){return(this.getSeconds()<10?'0':'')+this.getSeconds();},u:function(){var m=this.getMilliseconds();return(m<10?'00':(m<100?'0':''))+m;},e:function(){return"Not Yet Supported";},I:function(){return"Not Yet Supported";},O:function(){return(-this.getTimezoneOffset()<0?'-':'+')+(Math.abs(this.getTimezoneOffset()/60)<10?'0':'')+(Math.abs(this.getTimezoneOffset()/60))+'00';},P:function(){return(-this.getTimezoneOffset()<0?'-':'+')+(Math.abs(this.getTimezoneOffset()/60)<10?'0':'')+(Math.abs(this.getTimezoneOffset()/60))+':00';},T:function(){var m=this.getMonth();this.setMonth(0);var result=this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/,'$1');this.setMonth(m);return result;},Z:function(){return-this.getTimezoneOffset()*60;},c:function(){return this.format("Y-m-d\\TH:i:sP");},r:function(){return this.toString();},U:function(){return this.getTime()/1000;}};
