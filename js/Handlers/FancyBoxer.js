function FancyBoxer( grmbleChat )
{
    this.types = [ 'message' ];
    this.priority = -1000; // must run after MessageRenderer
    
    this.HandleMessage = function( msg )
    {
        $("a[id|=fancyImg]").each(function() {
            $(this).fancybox();
        });        
    };
};

