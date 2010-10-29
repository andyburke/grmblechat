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

