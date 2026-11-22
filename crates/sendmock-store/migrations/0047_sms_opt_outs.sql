-- Contacts who texted an opt-out keyword (STOP and the like), per sender: your app's number,
-- or the Messaging Service the number is in, as Twilio's Advanced Opt-Out keeps them. A send
-- from that sender to the contact is refused with 21610 until the contact texts START.
CREATE TABLE sms_opt_outs (
    sender TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    keyword TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (sender, contact_number)
) STRICT;
