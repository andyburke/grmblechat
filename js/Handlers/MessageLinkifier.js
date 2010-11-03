function MessageLinkifier( grmbleChat )
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
