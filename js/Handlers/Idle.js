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
