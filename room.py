from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.db import Key
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from datetime import datetime

from models import *
from utils import *

from django.utils import simplejson


class RoomCollectionHandler(webapp.RequestHandler):

    @LoginRequired
    def get(self):
        rooms = Room.all().order('name')
        self.response.out.write(template.render('templates/room_collection.html',
                                                {'rooms': rooms}
                                                ))
    @LoginRequired
    def post(self):
        account = get_account()

        if ( not account ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have an account!' } ) )
            return

        name = self.request.get('name')
        room = Room.all().filter('name =', name).get()
        if room:
            self.response.out.write(template.render('templates/room_collection.html',
                                                    {'error_msg': 'A room by that name already exists.',
                                                     'name': name}
                                                    ))
            return

        room = Room( name = name )
        room.put()
        RoomAdmin( room = room, account = account ).put() # make the creator an admin
        self.redirect( '/room/' + str( room.key() ) )

class RoomHandler(webapp.RequestHandler):

    @LoginRequired
    def get(self, room_key):
        room = Room.all().filter('__key__ =', Key(room_key)).get()
        if not room:
            # room doesn't exist
            self.error(404)
            self.response.out.write("no such room")
            return
        account = get_account()
        admin = RoomAdmin.all().filter( 'room = ', room ).filter( 'account =', account ).get()
        roomlist_query = RoomList.all()
        roomlist_query.filter('room = ', room)
        roomlist = roomlist_query.filter('account = ', account).get()
        if not roomlist:
            #add us to the room we've just joined.
            roomlist = RoomList(account=account, room=room)
            roomlist.put()
            #send a message to update everyone elses contact list
            user = users.get_current_user()
            timestamp = datetime.now()
            message = Message( sender = account, room = room, timestamp = timestamp, type = 'join' )
            message.put()
            
        roomlist = RoomList.all().filter('room = ', room)
        roomlist = [ to_dict( roomlisting ) for roomlisting in roomlist ]
        context = {
            'room': room,
            'admin': admin,
            'room_json': simplejson.dumps( to_dict( room ) ),
            'account_json': simplejson.dumps( to_dict( account ) ),
            'roomlist': roomlist,
            }
        self.response.out.write( template.render( 'templates/room.html', context ) )

class AdminHandler( webapp.RequestHandler ):

    @LoginRequired
    def get( self, roomKey ):
        account = get_account()

        if ( not account ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate your account!' } ) )
            return

        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()

        if ( not room ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate a room for the key: %s' % room_key } ) )
            return

        admin = RoomAdmin.all().filter( 'room =', room ).filter( 'account =', account ).get()

        if ( not admin ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have admin priveledges for this room.' } ) )
            return

        self.response.out.write( template.render( 'templates/room_admin.html', { 'room': room, 'roomAPIURL': self.request.host_url + '/api/room/' + str( room.key() ), 'applied': self.request.get( 'applied', default_value = None ) } ) )
                                                    
    @LoginRequired
    def post( self, roomKey ):
        account = get_account()

        if ( not account ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate your account!' } ) )
            return

        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()

        if ( not room ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate a room for the key: %s' % room_key } ) )
            return

        admin = RoomAdmin.all().filter( 'room =', room ).filter( 'account =', account ).get()

        if ( not admin ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have admin priveledges for this room.' } ) )
            return

        room.name = self.request.get( 'roomName' )
        room.description = self.request.get( 'roomDescription' )
        room.apiKey = self.request.get( 'roomApiKey' )
        room.public = bool( self.request.get( 'public', default_value = False ) )
        room.invite = bool( self.request.get( 'invite', default_value = False ) )
        room.put()

        self.redirect( '/room/' + str( room.key() ) + '/admin?applied=1' )

class LeaveHandler( webapp.RequestHandler ):
    
    def post( self, room_key ):
        room = Room.all().filter( '__key__ =', Key( room_key ) ).get()
        account = get_account()
        leave_room( room = room, account = account )
        self.redirect( '/room/' )

application = webapp.WSGIApplication([('/room/', RoomCollectionHandler),
                                      (r'/room/([^/]+)', RoomHandler),
                                      (r'/room/([^/]+)/admin', AdminHandler),
                                      (r'/room/([^/]+)/leave', LeaveHandler)],
                                     debug=True)

def main():
    webapp.template.register_template_library( 'filters' )
    run_wsgi_app( application )

if __name__ == '__main__':
    main()
