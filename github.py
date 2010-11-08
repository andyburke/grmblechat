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


class GithubHandler( webapp.RequestHandler ):

    def post( self, roomKey, apiKey ):
        room = Room.all().filter( 'slug =', roomKey ).get()
        if not room:
            room = Room.all().filter( '__key__ =', Key( roomKey ) ).get()

        if ( not room ):
            self.response.out.write( simplejson.dumps( {'response_status' : 'No such room.' } ) )
            return

        if ( not len( room.apiKey ) ):
            self.response.out.write( simplejson.dumps( {'response_status' : 'No api access configured for room.' } ) )
            return

        if ( room.apiKey != apiKey ):
            self.response.out.write( simplejson.dumps( {'response_status' : 'Incorrect API key for room.' } ) )
            return

        timestamp = datetime.now()

        try:
            payload = simplejson.loads( cgi.escape( self.request.get( 'payload' ) ) )
        except Exception, e:
            self.response.out.write( simplejson.dumps( {'response_status' : 'Could not parse payload json: ' + str( e ) } ) )
            return

        repository = payload[ 'repository' ][ 'name' ]
        branch = payload[ 'ref' ]
        commits = payload[ 'commits' ]

        for commit in commits:
            content = "[%s/%s] %s - %s %s" % ( repository, branch, commit[ 'message' ], commit[ 'author' ][ 'name' ], commit[ 'url' ] )
            try:
                message = Message( nickname = 'github', room = room, timestamp = timestamp, content = content, type = 'message' )
                message.put()
            except Exception, e:
                self.response.out.write( simplejson.dumps( {'response_status' : 'Could not insert message into database: ' + str( e ) } ) )
                return

        json = simplejson.dumps( { 'response_status' : 'OK' } )
        self.response.out.write(json)

application = webapp.WSGIApplication( [
										(r'/api/room/([^/]+)/([^/]+)/github/', GithubHandler),
                                      ],
                                     debug = True )

def main():
    #logging.getLogger().setLevel( logging.DEBUG )
    run_wsgi_app( application )

if __name__ == '__main__':
    main()
