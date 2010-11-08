function AudioHandler()
{
    this.types = [ 'message' ];
    this.priority = 10;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.links.length > 0 )
        {
            for ( linkIndex = 0; linkIndex < msg.links.length; ++linkIndex )
            {
                if ( msg.links[ linkIndex ].href && msg.links[ linkIndex ].href.length > 0 )
                {
                    var audio = msg.links[ linkIndex ].href.match( /(https?:\/\/.*?mp3)(?:\W|$)/ig );
                    if ( audio && audio.length )
                    {
                        $.each( audio, function( i )
                        {
                            msg.links[ linkIndex ].newText = msg.links[ linkIndex ].href.replace( this, '<p id="audioplayer_' + msg.key + '">' + this +'</p><script type="text/javascript"> AudioPlayer.embed("audioplayer_' + msg.key +'", {soundFile: "' + this +'"});</script>' );
                        });
                    }
                }
            }
        }
    };
};
