var HighlightMeHandler = function()
{
    this.types = [ 'message' ];
    this.priority = -101;

    var soundURL = '/sounds/direct_message.wav';
    var lastSoundPlayTime = new Date();
    var minTimeBetweenSoundPlays = 5000; // 5 seconds

    var userRegexp = new RegExp( chat.account.nickname, "ig" );

    this.HandleMessage = function( msg )
    {
        var messages = $(".msg-content:contains('" + chat.account.nickname + "')").add(".msg-content:contains('" + chat.account.nickname.toLowerCase() + "')");

        messages.css({
        '-moz-box-shadow': '2px #44A',
        '-webkit-box-shadow': '2px #44A',
        'background-color': '#DDF'
        });

        if ( msg.content.match( userRegexp ) )
        {
            var now = new Date();

            // FIXME: playing sounds using this plugin will bring a mozilla window to the foreground,
            //        if there's ever a fix for that, we should remove this browser check
            if ( !$.browser.mozilla )
            {
                if ( now - lastSoundPlayTime > minTimeBetweenSoundPlays )
                {
                    $.sound.play( soundURL );
                    lastSoundPlayTime = now;
                }
            }
        }
    };
};