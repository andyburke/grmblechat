import urllib
import hashlib
import re
import datetime
import time
from google.appengine.api import users
from google.appengine.ext import db

from models import *


__all__ = ['leave_room', 'gravatar', 'get_account', 'transform_message', 'to_dict' ]


def leave_room(room=None, account=None, session=None):
    """
    Handles app logic for a user leaving a room.

    Must be passed *either* a Room and Account object, or a RoomList object.

    Examples
    --------
    leave_room(room=room_obj, account=account_obj)
    leave_room(session=roomlist_obj)
    """
    if room is not None and account is not None:
        session = RoomList.all().filter('room =', room).filter('account =', account).get()
    elif session is not None:
        room = session.room
        account = session.account
    else:
        raise TypeError("must specify either room and account, or session")

    # clean up the session record
    session.delete()

    # send a message to the room about the part
    timestamp = datetime.datetime.now()
    message = Message(sender=account, room=room, timestamp=timestamp,
                      event=Message_event_codes['part'])
    message.put()


def gravatar(email):
    size=30
    rating='g'
    default_image='identicon'
    gravatar_url = "http://www.gravatar.com/avatar.php?"
    #gravatar_url += hashlib.md5(email).hexdigest()
    gravatar_url += urllib.urlencode({
        'gravatar_id':hashlib.md5(email).hexdigest(),
        's':str(size),
        'r':rating,
        'd':default_image})
    return """<img src="%s" alt="gravatar" />""" % gravatar_url


def get_account():
    user = users.get_current_user()
    account = Account.all().filter('user =', user).get()
    return account
    
def transform_message(message):
    content = message.content
    if content is not None:
        r="((?:https?)://[^ \t\n\r()\"']+)"
        m = re.search(r, content)
        if (m):
            url = m.group(1)
            #content=re.sub(r,r'<img src="\1">',content)
            #content=re.sub(r,r'<a href="\1">\1</a>',content)
            r2="(?i)\.(jpg|png|gif)$"
            m = re.search(r2,url)
            r2="(?i)\.(mp3)$"
            m2 = re.search(r2,url)
            new_content = ''
            if (m):
                new_content = '<a href="' + url + '" target="_blank">' + '<img class="embedded-image" src="' + url + '">' + '</a>'
            elif (m2):
                new_content = '<p id="audioplayer_' + str(message.key().id()) +'">'+ url +'</p><script type="text/javascript"> AudioPlayer.embed("audioplayer_' + str(message.key().id()) +'", {soundFile: "' + url +'"});</script>'  
            else:
                new_content = '<a href="' + url + '" target="_blank">' + url + '</a>'
            content = re.sub(r,new_content,content)
        message.content = content
    else:
        message.content = ''
    return message

# from stackoverflow

SIMPLE_TYPES = ( int, long, float, bool, dict, basestring, list )

def to_dict( model ):
    output = {}

    for key, prop in model.properties().iteritems():
        value = getattr( model, key )

        if value is None or isinstance( value, SIMPLE_TYPES ):
            output[ key ] = value
        elif isinstance( value, datetime.date ):
            # Convert date/datetime to ms-since-epoch ("new Date()").
            ms = time.mktime( value.utctimetuple() ) * 1000
            ms += getattr( value, 'microseconds', 0 ) / 1000
            output[ key ] = int( ms )
        elif isinstance( value, db.Model ):
            output[ key ] = to_dict( value )
        elif isinstance( value, db.UserProperty ):
            output[ key ] = { email: value.email, nickname: value.nickname, user_id: value.user_id }
        elif isinstance( value, users.User ):
            output[ key ] = {}
            methods = ['nickname', 'email', 'user_id'] 
            for method in methods: 
                output[ key ][ method ] = getattr( value, method )() 
        else:
            raise ValueError( 'cannot encode ' + repr( prop ) )

    return output