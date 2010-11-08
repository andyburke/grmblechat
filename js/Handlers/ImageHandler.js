function ImageHandler( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = 10;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.links.length > 0 )
        {
            for ( linkIndex = 0; linkIndex < msg.links.length; ++linkIndex )
            {
                if ( msg.links[ linkIndex ].href )
                {
                    var image = msg.links[ linkIndex ].href.match( /(https?:\/\/.*?\.(png|jpg|gif))(?:\W|$)/ig );
                    if ( image && image.length )
                    {
                        $.each( image, function( i )
                        {
                            msg.links[ linkIndex ].newText = msg.links[ linkIndex ].href.replace( this, '<img style="max-width: 90%" src="' + this + '">' );
                        });
                    }
                }
            }
        }
    };
};
