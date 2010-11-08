function YoutubeHandler( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = 100;

    // via stackoverflow
    var vidWidth = 480;
    var vidHeight = 360;
   
    var obj = '<object width="' + vidWidth + '" height="' + vidHeight + '">' +
         '<param name="movie" value="http://www.youtube.com/v/[vid]&hl=en&fs=1">' +
         '</param><param name="allowFullScreen" value="true"></param><param ' +
         'name="allowscriptaccess" value="always"></param><em' +
         'bed src="http://www.youtube.com/v/[vid]&hl=en&fs=1" ' +
         'type="application/x-shockwave-flash" allowscriptaccess="always" ' +
         'allowfullscreen="true" width="' + vidWidth + '" ' + 'height="' +
         vidHeight + '"></embed></object> ';

    this.HandleMessage = function( msg )
    {
        if ( msg.links.length > 0 )
        {
            for ( linkIndex = 0; linkIndex < msg.links.length; ++linkIndex )
            {
                if ( msg.links[ linkIndex ].href && msg.links[ linkIndex ].href.length > 0 )
                {
                    var vid = msg.links[ linkIndex ].href.match( /(?:https?:\/\/)(?:www\.)youtube\.com\/watch\?v=\S+/ig);
                    if ( vid && vid.length )
                    {
                        $.each( vid, function(i) {
                            var video = msg.links[ linkIndex ].href.match( /\?v=\w[\w|-]*/ig );
                            if ( video && video.length )
                            {
                                msg.links[ linkIndex ].newText = msg.links[ linkIndex ].href.replace( this, obj.replace(/\[vid\]/g, video[ 0 ].replace( '?v=', '' ) ) );
                            }
                        });
                    }
                }
            }
        }
    };
};
