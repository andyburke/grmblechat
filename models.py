from google.appengine.ext import db
from datetime import datetime


__all__ = ['Account', 'Room', 'RoomAdmin', 'RoomList', 'Message']

class Account( db.Model ):
    user = db.UserProperty(required=True)
    nickname = db.StringProperty(required=True)
    url = db.StringProperty(default='')
    gravatar_tag = db.StringProperty(default='')    


class Room( db.Model ):
    name = db.StringProperty(required=True)
    description = db.StringProperty( default = '' )
    topic = db.StringProperty( default = '' )
    public = db.BooleanProperty( default = True )
    invite = db.BooleanProperty( default = False )
    apiKey = db.StringProperty( default = '' )
    slug = db.StringProperty()

class RoomAdmin( db.Model ):
    room = db.ReferenceProperty( reference_class = Room, required = True )
    account = db.ReferenceProperty( reference_class = Account, required = True )

class RoomList(db.Model):
    account = db.ReferenceProperty( reference_class = Account, required = True )
    room = db.ReferenceProperty( reference_class = Room, required = True )
    status = db.StringProperty( default = '' )
    last_seen = db.DateTimeProperty( auto_now_add = True, required = True )
    status = db.StringProperty( default = '' )
    status_start = db.DateTimeProperty()

    def update_presence(self):
        self.last_seen = datetime.now()
        self.put()

class Message(db.Model):
    nickname = db.StringProperty()
    sender = db.ReferenceProperty( reference_class=Account )
    room = db.ReferenceProperty( reference_class = Room, required = True )
    timestamp = db.DateTimeProperty( auto_now_add = True, required = True )
    type = db.StringProperty( required = True )
    content = db.StringProperty()
