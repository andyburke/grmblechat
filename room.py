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


class RoomCollectionHandler(webapp.RequestHandler):

    @LoginRequired
    def get(self):
        rooms = Room.all().order('name')
        roomlist = RoomList.all()
        self.response.out.write(template.render('templates/room_collection.html',
                                                {'rooms': rooms, 
                                                 'roomlist': roomlist}
                                                ))
    @LoginRequired
    def post(self):
        account = get_account()

        if ( not account ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have an account!' } ) )
            return

#FIXME: emit a warning when you make a room that already exists

        name = self.request.get( 'name' )
        slug = name.lower()
        slug = re.sub(r'\W+', '', slug)
        room = Room.all().filter( 'slug =', slug ).get()
        i = 1
        while room:
            slug = slug + str( i )
            room = Room.all().filter( 'slug =', slug ).get()
            i += 1
        room = Room( name = name, slug = slug, description = self.request.get( 'description' ) )
        room.put()

        RoomAdmin( room = room, account = account ).put() # make the creator an admin

        self.redirect('/room/' + slug)
            

class RoomHandler(webapp.RequestHandler):

    @LoginRequired
    def get(self, roomKey):
        room = Room.all().filter( 'slug =', roomKey ).get()
        if not room:
            room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()
            if not room:
                # room doesn't exist
                self.error(404)
                self.response.out.write("no such room")
                return

        account = get_account()
        if not account:
            self.redirect('/account/')
            return

        admin = RoomAdmin.all().filter( 'room = ', room ).filter( 'account =', account ).get()
            
        context = {
            'room': room,
            'admin': admin,
            'room_json': simplejson.dumps( to_dict( room ) ),
            'account_json': simplejson.dumps( to_dict( account ) ),
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
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate a room for the key: %s' % roomKey } ) )
            return

        admin = RoomAdmin.all().filter( 'room =', room ).filter( 'account =', account ).get()

        if ( not admin ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have admin priveledges for this room.' } ) )
            return

        context = {
            'room': room,
            'roomAPIURL': self.request.host_url + '/api/room/' + str( room.key() ),
            'applied': self.request.get( 'applied', default_value = None )
        }

        if ( room.apiKey ):
            context[ 'roomGithubPostbackURL' ] = self.request.host_url + '/api/room/' + str( room.key() ) + '/' + room.apiKey + '/github/'

        self.response.out.write( template.render( 'templates/room_admin.html', context ) )
                                                    
    @LoginRequired
    def post( self, roomKey ):
        account = get_account()

        if ( not account ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate your account!' } ) )
            return

        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()

        if ( not room ):
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'Could not locate a room for the key: %s' % roomKey } ) )
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
    
    def post( self, roomKey ):
        room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()
        account = get_account()
        leave_room( room = room, account = account )
        self.redirect( '/room/' )

application = webapp.WSGIApplication([
                                        ( '/room/', RoomCollectionHandler ),
                                        ( r'/room/([^/]+)', RoomHandler ),
                                        ( r'/room/([^/]+)/admin', AdminHandler ),
                                        ( r'/room/([^/]+)/leave', LeaveHandler ),
                                      ],
                                     debug=True)

def main():
    webapp.template.register_template_library( 'filters' )
    run_wsgi_app( application )

if __name__ == '__main__':
    main()
