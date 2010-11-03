function AudioHandler()
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
