from twilio.rest.resources.util import normalize_dates

from twilio.rest.resources import InstanceResource, ListResource


class Transcription(InstanceResource):
    pass


class Transcriptions(ListResource):

    name = "Transcriptions"
    instance = Transcription

    def list(self, **kwargs):
        """
        Return a list of :class:`Transcription` resources
        """
        return self.get_instances(kwargs)


class Recording(InstanceResource):

    subresources = [Transcriptions]

    def __init__(self, *args, **kwargs):
        super(Recording, self).__init__(*args, **kwargs)
        self.formats = {
            "mp3": self.uri + ".mp3",
            "wav": self.uri + ".wav",
        }

    def delete(self):
        """
        Delete this recording
        """
        return self.delete_instance()


class Recordings(ListResource):

    name = "Recordings"
    instance = Recording

    @normalize_dates
    def list(self, before=None, after=None, **kwargs):
        """
        Returns a page of :class:`Recording` resources as a list.
        For paging information see :class:`ListResource`.

        :param date after: Only list recordings logged after this datetime
        :param date before: Only list recordings logger before this datetime
        :param call_sid: Only list recordings from this :class:`Call`
        """
        kwargs["DateCreated<"] = before
        kwargs["DateCreated>"] = after
        return self.get_instances(kwargs)

    def delete(self, sid):
        """
        Delete the given recording
        """
        return self.delete_instance(sid)
