function IdleNotifications( grmbleChat )
{
    this.grmbleChat = grmbleChat;
    this.types = [ 'message', 'idle', 'active' ];
    this.priority = 0;
    
    var faviconURL = '/images/grmblechat.png';
    var faviconActivityURLs = [ faviconURL, '/images/grmblechat-activity.png' ];
    var curFaviconIndex = 0;
    var animatingCallbackId = null;
    var soundURL = '/sounds/message.wav';
    var minTimeBetweenSoundPlays = 5000; // 5 seconds
    var isIdle = false;
    var missedMessageCount = 0;
    var lastSoundPlayTime = new Date();
    
    animateFavicon = function()
    {
        if ( isIdle )
        {
            document.getElementById( 'favicon' ).href = faviconActivityURLs[ curFaviconIndex++ % faviconActivityURLs.length ];
            animatingFaviconId = setTimeout( animateFavicon, 1000 );
        }
        else
        {
            document.getElementById( 'favicon' ).href = faviconURL;
            animatingFaviconId = null;
            curFaviconIndex = 0;
        }
    }
    
    this.HandleMessage = function( msg )
    {
        switch( msg.type )
        {
        case 'idle':
            if ( msg.sender.key == this.grmbleChat.account.key )
            {
                isIdle = true;
            }
            break;
        case 'active':
            if ( msg.sender.key == this.grmbleChat.account.key )
            {
                isIdle = false;
                missedMessageCount = 0;
                document.title = this.grmbleChat.room.name + ': ' + this.grmbleChat.room.topic;
            }
            break;
        case 'message':
        default:
            if ( isIdle )
            {
                var now = new Date();

                if ( this.grmbleChat.account.playSoundsOnMessagesWhenIdle )
                {
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
                
                ++missedMessageCount;
                document.title = '(' + missedMessageCount + ') ' + this.grmbleChat.room.name + ': ' + this.grmbleChat.room.topic;
            
                if ( animatingCallbackId == null )
                {
                    animatingCallbackId = setTimeout( animateFavicon, 1000 );
                }
            }
            break;
        }
    };
};