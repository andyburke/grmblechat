function MessageRenderer( grmbleChat )
{
    this.grmbleChat = grmbleChat;
    this.types = [ 'message', 'topic', 'join', 'part' ];
    this.priority = -100;
    
    var timestamp_display_format = 'g:i&\\n\\b\\s\\p;A';
    
    this.HandleMessage = function( msg )
    {
        msg.content = ( typeof( msg.content ) == 'undefined' || msg.content == null ) ? '' : ( msg.rawHTML ? msg.content : htmlEscape( msg.content ) );

        // check for existing message and fix it up        
        var $existingLocalMessage = $('#message-' + msg.clientKey );
        var $existingMessage = $('#message-' + msg.key );
        if ( $existingLocalMessage.length != 0 )
        {
            $existingLocalMessage.attr( "id", "message-" + msg.key );
            $existingLocalMessage.find('.msg-content').html( msg.content ); // i guess in case the server does something to our content?
            return;
        }
        else if ( $existingMessage.length != 0 )
        {
            $existingMessage.attr( "id", "message-" + msg.key );
            $existingMessage.find('.msg-content').html( msg.content ); // i guess in case the server does something to our content?
            return;
        }
        
        msg.friendlyTimestamp = new Date( msg.timestamp ).format( timestamp_display_format );
        html = this.grmbleChat.GetTemplateSystem().render( 'message_template', msg );
        lastRow = $( '#chatlog tr:last' )
        if ( lastRow.length != 0 )
        {
            lastRow.after( html );
        }
        else // we have no messages yet
        {
            $( '#chatlog' ).append( html );
        }

        // FIXME: shouldn't do this if the user has scrolled the page, instead we should show that there are new messages somehow
        this.grmbleChat.ScrollToBottom();
    };
};

