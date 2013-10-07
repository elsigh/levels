#!/usr/bin/python2.7
#
#

import logging
import webapp2

from google.appengine.api import mail

from webapp2_extras import jinja2

import settings

app_instance_static = webapp2.WSGIApplication()


def render_template(tpl_name, tpl_data, app=app_instance_static):
    return jinja2.get_jinja2(
        app=app_instance_static).render_template(tpl_name, **tpl_data)


def send_email(to, subject, body):
    logging.info('send_email %s, %s, %s' % (to, subject, body))
    try:
        # First generate an HTML version of the email.
        tpl_name = 'email_base.html'
        tpl_data = {
            'body': body
        }
        html_body = render_template(tpl_name, tpl_data)
        #logging.info('html_body: %s', html_body)
        mail.send_mail(sender=settings.MAIL_FROM,
                       to=to,
                       subject=subject,
                       body=body,
                       html=html_body)
    except Exception, e:
        logging.info('Exception e: %s' % e)
        pass

    return True
