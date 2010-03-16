from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.db import Key
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app

from datetime import datetime
from django.utils import simplejson

from models import *

class MessageCollectionHandler(webapp.RequestHandler):

    def post(self, room_key):
        user = users.get_current_user()
        sender = Account.all().filter('user =', user).get()
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        timestamp = datetime.now()
        content = self.request.get('content')
        if not sender:
            # no account for this user
            self.response.out.write(template.render('templates/account_create.html', None))
        elif len(content):
            # only create message if content is not empty
            message = Message(sender=sender, room=room, timestamp=timestamp, content=content)
            message.put()
        self.redirect('/room/' + room_key)

class APIMessageHandler(webapp.RequestHandler):

    def get(self, room_key, message_key):
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        message = Message.all().filter('__key__ =', Key(message_key)).get()
        if not room:
            # room doesn't exist
            self.error(404)
            self.response.out.write("no such room")
        else:
            url = "/api/"
            sender_url = url + "account/" + str(message.sender.key())
            room_url = url + "room/" + str(message.room.key())
            payload = {'timestamp' : message.timestamp.isoformat(), 'content' : message.content, 
                       'sender' : sender_url, 'room' : room_url}
            json = simplejson.dumps(payload)
            self.response.out.write(json)

class APIMessageCollectionHandler(webapp.RequestHandler):

    def get(self, room_key):
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        if not room:
            # room doesn't exist
            self.error(404)
            self.response.out.write("no such room")
        else:
            since_message_key = self.request.get('since')
            date_start = self.request.get('start')
            date_end = self.request.get('end')
            query_terms = self.request.get('q')
            messages = Message.all().order('timestamp')
            if since_message_key != '':
                # restrict by newer than message (specified by key)
                # FIXME timestamps might collide, so we need to introduce
                #   a new column populated by a counter (sharded?)
                since_message = Message.all().filter('__key__ =', Key(since_message_key)).get()
                messages = messages.filter('timestamp >', since_message.timestamp)
            elif date_start != '' and date_end != '':
                # restrict by starting/ending datetime
                iso8601_format = '%Y-%m-%dT%H:%M:%S'
                dt_start = datetime.strptime(date_start, iso8601_format)
                dt_end = datetime.strptime(date_end, iso8601_format)
                messages = messages.filter('timestamp >=', dt_start).filter('timestamp <=', dt_end)
            elif query_terms != '':
                # TODO filter by query terms
                pass
            else:
                # return (up to) last 40 messages
                # FIXME should define '40' as a constant
                messages = reversed(Message.all().order('-timestamp').fetch(40))
            url = "/api/"
            payload = []
            for message in messages:
                sender_url = url + "account/" + str(message.sender.key())
                room_url = url + "room/" + str(message.room.key())
                payload.append({'timestamp' : message.timestamp.isoformat(), 'content' : message.content, 
                                'sender' : sender_url, 'room' : room_url})
            json = simplejson.dumps(payload)
            self.response.out.write(json)

class TopicHandler(webapp.RequestHandler):

    def post(self, room_key):
        user = users.get_current_user()
        sender = Account.all().filter('user =', user).get()
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        topic = self.request.get('topic')
        if not sender:
            # no account for this user
            self.response.out.write(template.render('templates/account_create.html', None))
        elif len(topic):
			room.topic = topic
			room.put()
        self.redirect('/room/' + room_key)       


application = webapp.WSGIApplication([(r'/room/([^/]+)/msg', MessageCollectionHandler),
                                      (r'/room/([^/]+)/topic',TopicHandler),
                                      (r'/api/room/([^/]+)/msg/', APIMessageCollectionHandler),
                                      (r'/api/room/([^/]+)/msg/([^/]+)', APIMessageHandler),
                                      ],
                                     debug=True)

def main():
    run_wsgi_app(application)

if __name__ == '__main__':
    main()
