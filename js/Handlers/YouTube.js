function YoutubeHandler( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = 100;

    // via stackoverflow
    var vidWidth = 480;
    var vidHeight = 360;
   
    // Tthis could be done by creating an object, adding attributes & inserting parameters, but this is quicker
    var e1 = '<obj'+'ect width="' + vidWidth + '" height="' + vidHeight + '"><param name="movie" value="http://www.youtube.com/v/';
    var e2 = '&hl=en&fs=1"></param><param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param><embed src="http://www.youtube.com/v/';
    var e3 = '&hl=en&fs=1" type="application/x-shockwave-flash" allowscriptaccess="always" allowfullscreen="true" width="' + vidWidth + '" ' + 'height="' + vidHeight + '"></embed></object> ';

    this.HandleMessage = function( msg )
    {
        if ( msg.rawHTML )
        {
            return;
        }
        
        var vid = msg.content.match(/((\?v=)(\w[\w|-]*))/g); // end up with ?v=oHg5SJYRHA0
        if ( vid && vid.length )
        {
            $.each( vid, function(i) {
                var ytid = this.replace(/\?v=/,'') // end up with oHg5SJYRHA0
                msg.content = e1 + ytid + e2 + ytid + e3;
                msg.rawHTML = true;
            })
        }
    };
};
