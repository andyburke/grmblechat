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

            if ( msg.sender.key != this.grmbleChat.GetAccount().key ) // don't remove ourselves on our old part messages
            {
                this.grmbleChat.RemoveNickname( msg.nickname ? msg.nickname : msg.sender.nickname );
    
                var $removeuser = 'user-' + msg.sender.key;
                $("#" + $removeuser).fadeTo( 'slow', 0.0 );
                $("#" + $removeuser).remove();
            }
            break;
        case 'join':

            // FIXME: these two tests are essentially the same (js array and userlist entry)

            this.grmbleChat.AddNickname( msg.nickname ? msg.nickname : msg.sender.nickname );
                        
            var $adduser = 'user-' + msg.sender.key;
            if ( $("#" + $adduser).length == 0 )
            {
                $('#userlist tr:last').after( this.grmbleChat.GetTemplateSystem().render( 'user_list_entry_template', msg.sender ? msg.sender : { 'nickname': msg.nickname } ) );
            }
            break;
        default:
            break;            
        }
    }
}
