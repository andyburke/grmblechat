function ImageHandler( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = 10;
    
    this.HandleMessage = function( msg )
    {
        if ( msg.rawHTML )
        {
            return;
        }
        
        var image = msg.content.match( /(https?:\/\/.*?\.(png|jpg|gif))(?:\W|$)/ig );
        if ( image && image.length )
        {
            $.each( image, function( i )
            {
                msg.content = msg.content.replace( this, '<img style="max-width: 90%" src="' + this + '">' );
            });
            
            msg.rawHTML = true;
        }
    };
};
