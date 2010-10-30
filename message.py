import logging
import cgi

from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.db import Key
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app

from datetime import datetime
from django.utils import simplejson

from models import *
from utils import *


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
            message = Message( sender = sender, room = room, timestamp = timestamp, content = content, type = 'message')
            message.put()
        self.redirect('/room/' + room_key)

class APIMessageHandler(webapp.RequestHandler):

    def get(self, room_key, message_key):
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        if not room:
            self.error(404)
            self.response.out.write("no such room")
            return
        message = Message.all().filter('__key__ =', Key(message_key), 'room =', room).get()
        if not message:
            self.error(404)
            self.response.out.write("no such message")
            return
        json = simplejson.dumps( to_dict( message ) )
        self.response.out.write(json)

class APIMessageCollectionHandler( webapp.RequestHandler ):

    def post( self, room_key ):
        user = users.get_current_user()
        sender = Account.all().filter('user =', user).get()
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        timestamp = datetime.now()

        try:
            clientMessage = simplejson.loads( cgi.escape( self.request.get( 'message' ) ) )
        except Exception, e:
            self.response.out.write( simplejson.dumps( {'response_status' : 'Could not parse message json: ' + str( e ) } ) )
            return

        payload = { 'response_status' : 'Programming error.' }
        if not clientMessage[ 'apiKey' ] and not sender:
            # no account for this user
            payload = {'response_status' : "No Account Found"}
        
        if clientMessage[ 'apiKey' ]:
            if ( room.apiKey == clientMessage[ 'apiKey' ] ):
                try:
                    message = Message( nickname = clientMessage[ 'nickname' ], sender = sender, room = room, timestamp = timestamp, content = clientMessage[ 'content' ], type = clientMessage[ 'type' ] )
                    message.put()
                except Exception, e:
                    payload = { 'response_status' : 'Could not insert message into database: ' + str( e ) }
            else:
                payload = { 'response_status': 'Invalid apiKey for room.' }
        else:
            message = Message( nickname = sender.nickname, sender = sender, room = room, timestamp = timestamp, content = clientMessage[ 'content' ], type = clientMessage[ 'type' ] )
            message.put()

        if ( message ):

            message = to_dict( message ) # populates the key field for us

            if ( clientMessage[ 'key' ] ):
                message[ 'clientKey' ] = clientMessage[ 'key' ] # so the client can reset their local key

            payload = {
                        'response_status' : "OK",
                        'message' : message,
                        'next' : 'room/%s/msg/?since=%s' % ( room.key(), message[ 'key' ] )
                      }
                      
        json = simplejson.dumps(payload)
        self.response.out.write(json)

    def get(self, room_key):
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        if not room:
            # room doesn't exist
            self.error(404)
            self.response.out.write("no such room")
        else:
            account = get_account()
            roomlist = RoomList.all().filter('account =', account).filter('room =', room).get()
            roomlist.update_presence()
            since_message_key = self.request.get('since')
            date_start = self.request.get('start')
            date_end = self.request.get('end')
            query_terms = self.request.get('q')
            messages = Message.all().filter('room =', room).order('timestamp')
            next_url = None
            if since_message_key != '':
                # restrict by newer than message (specified by key)
                # FIXME timestamps might collide, so we need to introduce
                #   a new column populated by a counter (sharded?)
                since_message = Message.all().filter('__key__ =', Key(since_message_key)).get()
                # need to enumerate query results to access last message
                messages = [m for m in messages.filter('timestamp >', since_message.timestamp)]
                if messages:
                    next_url = 'room/%s/msg/?since=%s' % (room.key(), messages[-1].key())

                roomlist.status = self.request.get( 'status' )
                roomlist.status_start_time = self.request.get( 'status_start_time' )

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
                # return (up to) last 70 messages
                # FIXME should define '70' as a constant
                # need to enumerate query results to access last message
                # erg, need to order by type due to datastore limitations on inequality filters (http://code.google.com/appengine/docs/python/datastore/queriesandindexes.html#Restrictions_on_Queries)
                messages = [m for m in reversed(Message.all().filter('room =', room).order('-timestamp').fetch(200))]
                if messages:
                    # we actually want to set this before we cull the idle/active messages
                    # otherwise, their next query may pick up lots of unnecessary idle/active messages
                    next_url = 'room/%s/msg/?since=%s' % (room.key(), messages[-1].key())
                    nonIdleMessages = []
                    for m in messages:
                        if ( m.type != 'idle' and m.type != 'active' ):
                            logging.debug( 'Appended message of type \'%s\' to unlimited message query' % m.type )
                            nonIdleMessages.append( m )
                    messages = nonIdleMessages
                else:
                    next_url = 'room/%s/msg/' % (room.key())
            url_base = "/api/"
            payload = {}
            if messages:
                payload[ 'messages' ] = [ to_dict( m ) for m in messages ]
                if next_url:
                    payload[ 'next' ] = url_base + next_url
            json = simplejson.dumps( payload )
            self.response.out.write( json )

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
        
class APITopicHandler(webapp.RequestHandler):

    def post(self, room_key):
        user = users.get_current_user()
        sender = Account.all().filter('user =', user).get()
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        topic = self.request.get('topic')
        timestamp = datetime.now()
        #content = self.request.get('message')
        payload = {}
        if not sender:
            # no account for this user
            payload = {'response_status' : "No Account Found"}
        elif len(topic):
            # only create message if topic is not empty
            room.topic = topic
            room.put()
            message = Message( sender = sender, room = room, timestamp = timestamp, content = topic, type = 'topic' )
            message.put()
            payload = {'response_status' : "OK", 'message' : topic, 'timestamp' : timestamp.isoformat()}
        else:
            payload = {'response_status' : "Unknown Error"}
        json = simplejson.dumps(payload)
        self.response.out.write(json)    


application = webapp.WSGIApplication([(r'/room/([^/]+)/msg', MessageCollectionHandler),
                                      (r'/room/([^/]+)/topic',TopicHandler),
                                      (r'/api/room/([^/]+)/topic',APITopicHandler),
                                      (r'/api/room/([^/]+)/msg/', APIMessageCollectionHandler),
                                      (r'/api/room/([^/]+)/msg/([^/]+)', APIMessageHandler),
                                      ],
                                     debug=True)

def main():
    #logging.getLogger().setLevel( logging.DEBUG )
    run_wsgi_app( application )

if __name__ == '__main__':
    main()
