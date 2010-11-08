import cgi
import logging

from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.db import Key
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from datetime import datetime

from models import *
from utils import *
import re

from django.utils import simplejson

def emitError( handler, errorString ):
    handler.response.out.write( simplejson.dumps( { 'response_status' : errorString } ) )


class AccountHandler( webapp.RequestHandler ):

    def get( self, accountKey ):
        account = get_account()
        targetAccount = Account.all().filter('__key__ =', Key( accountKey ) ).get()

        if not targetAccount:
            emitError( self, 'No such account.' )
            return

        if account.key() != targetAccount.key():
            emitError( self, 'You do not have permission to modify this account!' )
            return

        self.response.out.write( simplejson.dumps( to_dict( account ) ) )

    def post( self, accountKey ):
        account = get_account()
        targetAccount = Account.all().filter('__key__ =', Key( accountKey ) ).get()

        if not targetAccount:
            emitError( self, 'No such account.' )
            return

        if account.key() != targetAccount.key():
            emitError( self, 'You do not have permission to modify this account!' )
            return

        account.nickname = self.request.get( 'nickname' )
        account.playSoundsOnMessagesWhenIdle = bool( self.request.get( 'playSoundsOnMessagesWhenIdle', default_value = False ) )
        account.playSoundsOnDirectMessagesWhenIdle = bool( self.request.get( 'playSoundsOnDirectMessagesWhenIdle', default_value = False ) )
        account.put()

        self.response.out.write( simplejson.dumps( to_dict( account ) ) )

class UsersHandler( webapp.RequestHandler ):
    
    def get( self, roomKey ):
        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()
        account = get_account()

        if ( not room ):
            emitError( self, 'Could not locate a room for the key: %s' % roomKey )
            return

        if ( not account ):
            emitError( self, 'Could not validate your account' )
            return

        roomlist = RoomList.all().filter( 'account =', account ).filter( 'room =', room ).get()

        if ( not roomlist ):
            emitError( self, 'You are not in this room.' )
            return

        roomlist = RoomList.all().filter( 'room =', room )
        payload = [ to_dict( rl ) for rl in roomlist ]
        self.response.out.write( simplejson.dumps( payload ) )

class TopicHandler( webapp.RequestHandler ):

    def post( self, roomKey ):
        user = users.get_current_user()
        account = Account.all().filter( 'user =', user ).get()
        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()
        roomlist = RoomList.all().filter( 'account =', account ).filter( 'room =', room ).get()
        topic = self.request.get( 'topic' )
        timestamp = datetime.now()

        payload = {}
        if not account:
            emitError( self, 'No Account Found' )
            return

        if not room:
            emitError( self, 'No room found.' )
            return 

        if not roomlist:
            emitError( self, 'You are not in the channel.' )
            return
        
        if len( topic ) == 0:
            emitError( self, 'The topic must have a length.' )
            return
            
        room.topic = topic
        room.put()
        message = Message( sender = account, room = room, timestamp = timestamp, content = topic, type = 'topic' )
        message.put()
        payload = { 'response_status' : "OK", 'message' : to_dict( message ) }

        json = simplejson.dumps( payload )
        self.response.out.write( json )

class MessageCollectionHandler( webapp.RequestHandler ):

    def post( self, roomKey ):
        user = users.get_current_user()
        account = Account.all().filter('user =', user).get()
        room = Room.all().filter('__key__ =', Key( roomKey ) ).get()
        roomlist = RoomList.all().filter( 'room =', room ).filter( 'account =', account ).get()
        timestamp = datetime.now()

        try:
            clientMessage = simplejson.loads( self.request.get( 'message' ) )
        except Exception, e:
            emitError( self, 'Could not parse message json: ' + str( e ) )
            return

        if ( not 'apiKey' in clientMessage ) and not account:
            emitError( self, 'No Account Found' )
            return
        
        if 'apiKey' in clientMessage:
            if ( not 'nickname' in clientMessage or len( clientMessage[ 'nickname' ] ) == 0 ):
                emitError( self, 'No valid nickname specified in message.' )
                return

            if ( not len( room.apiKey ) ):
                emitError( self, 'No API access configured for this room.' )
                return
            
            if ( room.apiKey != clientMessage[ 'apiKey' ] ):
                emitError( self, 'Invalid apiKey for room.' )
                return

            try:
                message = Message( nickname = clientMessage[ 'nickname' ], sender = account, room = room, timestamp = timestamp, content = clientMessage[ 'content' ], type = clientMessage[ 'type' ] )
                message.put()
            except Exception, e:
                emitError( self, 'Could not insert message into database: ' + str( e ) )
                return

        else:

            if not roomlist:
                emitError( self, 'You are not in this channel.' )
                return

            try:
                message = Message( nickname = clientMessage[ 'nickname' ], sender = account, room = room, timestamp = timestamp, content = clientMessage[ 'content' ], type = clientMessage[ 'type' ] )
                message.put()
            except Exception, e:
                emitError( self, 'Could not insert message into database: ' + str( e ) )
                return

            if ( message.type == 'idle' or message.type == 'active' ):
                roomlist.status = message.type
                roomlist.status_start = timestamp
                roomlist.put()

        message = to_dict( message ) # populates the key field for us

        if ( 'key' in clientMessage ):
            message[ 'clientKey' ] = clientMessage[ 'key' ] # so the client can reset their local key

        payload = {
                    'response_status' : "OK",
                    'message' : message,
                    'next' : '/api/room/%s/msg/?since=%s' % ( room.key(), message[ 'key' ] )
                  }
                      
        json = simplejson.dumps(payload)
        self.response.out.write(json)

    def get(self, roomKey):
        user = users.get_current_user()
        account = Account.all().filter('user =', user).get()
        room = Room.all().filter('__key__ =', Key( roomKey ) ).get()
        roomlist = RoomList.all().filter( 'room =', room ).filter( 'account =', account ).get()

        if not room:
            emitError( self, "No such room: %s" % roomKey )
            return

        if not roomlist:
            emitError( self, 'You are not in this room.' )
            return

        roomlist.update_presence()

        since_message_key = self.request.get('since')
        date_start = self.request.get('start')
        date_end = self.request.get('end')
        query_terms = self.request.get('q')
        next_url = "%s?%s" % ( self.request.path, self.request.query_string )

        if since_message_key != '':
            # restrict by newer than message (specified by key)
            # FIXME timestamps might collide, so we need to introduce
            #   a new column populated by a counter (sharded?)
            since_message = Message.all().filter('__key__ =', Key(since_message_key)).get()
            # need to enumerate query results to access last message
            messages = [m for m in Message.all().filter( 'room =', room ).filter( 'timestamp >', since_message.timestamp ).order('timestamp')]
            if messages:
                next_url = '/api/room/%s/msg/?since=%s' % (room.key(), messages[-1].key())

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
            # return (up to) last 200 messages
            # FIXME should define '200' as a constant
            # need to enumerate query results to access last message
            # erg, need to order by type due to datastore limitations on inequality filters (http://code.google.com/appengine/docs/python/datastore/queriesandindexes.html#Restrictions_on_Queries)
            messages = [m for m in reversed(Message.all().filter('room =', room).order('-timestamp').fetch(200))]
            if messages:
                # we actually want to set this before we cull the idle/active messages
                # otherwise, their next query may pick up lots of unnecessary idle/active messages
                next_url = '/api/room/%s/msg/?since=%s' % (room.key(), messages[-1].key())
                nonIdleMessages = []
                for m in messages:
                    if ( m.type != 'idle' and m.type != 'active' ):
                        logging.debug( 'Appended message of type \'%s\' to unlimited message query' % m.type )
                        nonIdleMessages.append( m )
                messages = nonIdleMessages

        payload = { 'response_status': 'OK', 'messages': [] }
        if messages:
            payload[ 'messages' ] = [ to_dict( m ) for m in messages ]
        payload[ 'next' ] = next_url

        json = simplejson.dumps( payload )
        self.response.out.write( json )

class JoinHandler( webapp.RequestHandler ):

    def post( self, roomKey ):
        user = users.get_current_user()
        account = Account.all().filter( 'user =', user ).get()
        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()
        roomlist = RoomList.all().filter( 'account =', account ).filter( 'room =', room ).get()

        if not account:
            emitError( self, 'No Account Found' )
            return

        if not room:
            emitError( self, 'No room found.' )
            return

        payload = {}
        if roomlist:
            roomlist.status = 'active'
            roomlist.status_start = datetime.now()
            roomlist.update_presence()
            payload = { 'response_status': 'OK', 'existing_session': str( roomlist.key() ) }
        else:

            if ( room.invite ):
                roomInvite = RoomInvite.all().filter( 'room =', room ).filter( 'account =', account ).get()
                if not roomInvite:
                    roomAdmin = RoomAdmin.all().filter( 'room = ', room ).filter( 'account =', account ).get()
                    if not roomAdmin:
                        emitError( self, 'You do not have permission to join this room.' )
                        return

            roomlist = RoomList( account = account, room = room )
            roomlist.update_presence()

            Message( sender = account, room = room, timestamp = datetime.now(), type = 'join' ).put()

            payload = { 'response_status' : 'OK', 'new_session': str( roomlist.key() ) }

        json = simplejson.dumps( payload )
        self.response.out.write( json )

application = webapp.WSGIApplication([
                                        ( r'/api/account/([^/]+)', AccountHandler ),
                                        ( r'/api/room/([^/]+)/users/', UsersHandler ),
                                        ( r'/api/room/([^/]+)/topic/', TopicHandler ),
                                        ( r'/api/room/([^/]+)/msg/', MessageCollectionHandler ),
                                        ( r'/api/room/([^/]+)/join/', JoinHandler ),
                                      ],
                                     debug=True)

def main():
    webapp.template.register_template_library( 'filters' )
    run_wsgi_app( application )

if __name__ == '__main__':
    main()
