import urllib
import hashlib
import re
import markdown
from datetime import datetime
from google.appengine.api import users

from models import *


__all__ = ['leave_room', 'gravatar', 'slugify', 'get_account', 'transform_message']


def linkify(re_match):
   """Convert a single matched URL to markup to insert into a document
   in situ."""
   url = re_match.group(1)
   ext = url[-4:]
   if ext.lower() in (".png", ".jpg", ".gif"):
      return "[![Image]({})".format(url)
   else:
      return "<{}>".format(url)

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
    timestamp = datetime.now()
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


def slugify(title):
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    return slug


def get_account():
    user = users.get_current_user()
    account = Account.all().filter('user =', user).get()
    return account
    
def transform_message(message):
    content = message.content
    markdown.HTML_REMOVED_TEXT = ""
    md = markdown.Markdown(
            safe_mode="escape",
            output_format='html4'
    )
    md_nohtml = markdown.Markdown(
            safe_mode="replace",
            output_format='html4'
    )
    if content is not None:
        ## HTML is not a Regular language.  Here be dragons.
        content = re.sub(r"(?i)(https?://[^ \t\n\r()\"']+)", content, linkify)

        if (Message_event_names[message.event] == "topic"):
            message.content = md_nohtml.convert(content)
            message.content = re.sub("<\/?p>","", message.content)
        else:
            message.content = md.convert(content)
    else:
        message.content = ''
    return message
