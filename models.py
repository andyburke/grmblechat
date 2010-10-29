from google.appengine.ext import db
from datetime import datetime


__all__ = ['Account', 'Room', 'RoomList', 'Message']

class Account(db.Model):
    user = db.UserProperty(required=True)
    nickname = db.StringProperty(required=True)
    url = db.StringProperty(default='')
    gravatar_tag = db.StringProperty(default='')    


class Room(db.Model):
    name = db.StringProperty(required=True)
    topic = db.StringProperty(default='')


class RoomList(db.Model):
    account = db.ReferenceProperty(reference_class=Account, required=True)
    room = db.ReferenceProperty(reference_class=Room, required=True)
    status = db.StringProperty(default='')
    last_seen = db.DateTimeProperty(auto_now_add=True, required=True)
    status = db.StringProperty( default = '' )
    status_start = db.DateTimeProperty()

    def update_presence(self):
        self.last_seen = datetime.now()
        self.put()

class Message(db.Model):
    sender = db.ReferenceProperty(reference_class=Account, required=True)
    room = db.ReferenceProperty(reference_class=Room, required=True)
    timestamp = db.DateTimeProperty(auto_now_add=True, required=True)
    type = db.StringProperty(required=True)
    content = db.StringProperty()
