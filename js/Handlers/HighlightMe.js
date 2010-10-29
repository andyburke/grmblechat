var HighlightMeHandler = function()
{
    this.types = [ 'message' ];
    this.priority = -101;
    
    this.HandleMessage = function( msg )
    {
        var messages = $(".msg-content:contains('" + chat.account.nickname + "')").add(".msg-content:contains('" + chat.account.nickname.toLowerCase() + "')");

        messages.css({
        '-moz-box-shadow': '2px #44A',
        '-webkit-box-shadow': '2px #44A',
        'background-color': '#DDF'
        });        
    };
};