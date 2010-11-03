function TopicHandler( grmbleChat )
{
    this.grmbleChat = grmbleChat;
    this.types = [ 'topic' ];
    this.priority = 0;
    
    this.HandleMessage = function( msg )
    {
        this.grmbleChat.room.topic = msg.content;
        document.title = this.grmbleChat.room.name + ': ' + this.grmbleChat.room.topic;
        $('#room-topic').text( msg.content );

        // are these synchronous?  if so, this isn't good to do this way
        $('#room-topic').fadeTo( 'slow', 0.2 );
        $('#room-topic').fadeTo( 'slow', 1.0 );
    };
};