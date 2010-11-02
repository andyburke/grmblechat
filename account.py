from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.db import Key
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app

from models import *
from utils import *


class AccountCollectionHandler(webapp.RequestHandler):

    def get(self):
        #user = users.get_current_user()
        #account = Account.all().filter('user =', user).get()
        account = get_account()
        if account:
            # account exists
            self.redirect('/account/' + str(account.key()))
        else:
            # no account for this user
            self.response.out.write(template.render('templates/account_create.html', None))

    def post(self):
        user = users.get_current_user()
        nickname = self.request.get('nickname')
        if not len(nickname):
            # no nickname entered
            self.response.out.write(template.render('templates/account_create.html',
                                                    {'error_msg': 'Please enter a nickname.'}
                                                    ))
        else:
            account = Account(user=user, nickname=nickname)
            account.gravatar_tag = gravatar(user.email())
            account.put()
            self.redirect('/account/' + str(account.key()))
            

class AccountHandler(webapp.RequestHandler):

    @LoginRequired
    def get( self, accountKey ):
        account = get_account()
        targetAccount = Account.all().filter('__key__ =', Key( accountKey ) ).get()
        if not targetAccount:
            # account doesn't exist
            self.error(404)
            self.response.out.write("no such account")

        if account.key() != targetAccount.key():
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have permission to modify this account!' } ) )
            return

        self.response.out.write( template.render( 'templates/account.html', { 'account': account } ) )

    @LoginRequired
    def post( self, accountKey ):
        account = get_account()
        targetAccount = Account.all().filter('__key__ =', Key( accountKey ) ).get()
        if not targetAccount:
            # account doesn't exist
            self.error(404)
            self.response.out.write("no such account")

        if account.key() != targetAccount.key():
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have permission to modify this account!' } ) )
            return

        account.nickname = self.request.get( 'nickname' )
        account.playSoundsOnMessagesWhenIdle = bool( self.request.get( 'playSoundsOnMessagesWhenIdle', default_value = False ) )
        account.playSoundsOnDirectMessagesWhenIdle = bool( self.request.get( 'playSoundsOnDirectMessagesWhenIdle', default_value = False ) )
        account.put()

        self.redirect( '/account/' + str( account.key() ) + '?applied=1' )

class APIAccountHandler( webapp.RequestHandler ):

    @LoginRequired
    def get( self, accountKey ):
        account = get_account()
        targetAccount = Account.all().filter('__key__ =', Key( accountKey ) ).get()
        if not targetAccount:
            # account doesn't exist
            self.error(404)
            self.response.out.write("no such account")

        if account.key() != targetAccount.key():
            self.response.out.write( template.render( 'templates/error.html', { 'error': 'You do not have permission to modify this account!' } ) )
            return

        self.response.out.write( simplejson.dumps( to_dict( account ) ) )

application = webapp.WSGIApplication([('/account/', AccountCollectionHandler),
                                      (r'/account/([^/]+)', AccountHandler),
                                      (r'/api/account/([^/]+)', APIAccountHandler)],
                                     debug=True)


def main():
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
