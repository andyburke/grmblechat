function HighlightMeHandler( grmbleChat )
{
    this.grmbleChat = grmbleChat;
    this.types = [ 'message', 'idle', 'active' ];
    this.priority = -101;

    var isIdle = false;
    var soundURL = '/sounds/direct_message.wav';
    var lastSoundPlayTime = new Date();
    var minTimeBetweenSoundPlays = 5000; // 5 seconds

    var userRegexp = new RegExp( this.grmbleChat.GetAccount().nickname, "ig" );

    this.HandleMessage = function( msg )
    {
        var messages = $(".msg-content:contains('" + this.grmbleChat.GetAccount().nickname + "')").add(".msg-content:contains('" + this.grmbleChat.GetAccount().nickname.toLowerCase() + "')");

        messages.css({
        '-moz-box-shadow': '2px #44A',
        '-webkit-box-shadow': '2px #44A',
        'background-color': '#DDF'
        });

        switch( msg.type )
        {
        case 'idle':
            if ( msg.sender.key == this.grmbleChat.GetAccount().key )
            {
                isIdle = true;
            }
            break;
        case 'active':
            if ( msg.sender.key == this.grmbleChat.GetAccount().key )
            {
                isIdle = false;
            }
            break;
        case 'message':
        default:
            break;
        }

        if ( this.grmbleChat.GetAccount().playSoundsOnDirectMessagesWhenIdle && isIdle )
        {
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
        }
    };
};