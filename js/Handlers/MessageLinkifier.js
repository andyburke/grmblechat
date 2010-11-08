function MessageLinkifier( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = 50;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.links.length > 0 )
        {
            for ( linkIndex = 0; linkIndex < msg.links.length; ++linkIndex )
            {
                if ( msg.links[ linkIndex ].newText.length == 0 && msg.links[ linkIndex ].href && msg.links[ linkIndex ].href.length > 0 )
                {
                    msg.links[ linkIndex ].newText = '<a href="' + msg.links[ linkIndex ].href + '" title="' + msg.links[ linkIndex ].href + '" target="_blank">' + htmlEscape( msg.links[ linkIndex ].text ) + '<\/a>';
                }
            }
        }
    };
};
