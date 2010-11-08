function MessageLinkFinder( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = 500;
    
    this.HandleMessage = function( msg )
    {
        linkify( msg.content,
                 {
                   callback: function( text, href ) {
                      if ( !msg.links )
                      {
                          msg.links = [];
                      }
                      msg.links.push( { 'href': href, 'text': text, 'newText': '' } );
                   }
                });
    };
};
