# Sahara Santa

A web app where people sign in, join a Group, and are randomly assigned someone to give a gift to anonymously.

## Language

**Group**:
One Secret Santa event with its own Members, Budget, dates, and Draw.
_Avoid_: Event, party, room, circle

**Organizer**:
The Member who created a Group and controls its rules, joining, and Draw. Participates as a Member by default.
_Avoid_: Host, admin, owner

**Member**:
A signed-in person who has joined a Group and takes part as a giver and receiver.
_Avoid_: Participant, player, user

**Invite Link**:
A shareable link (with short code) that lets a signed-in person join a Group. Can be revoked or reset by the Organizer.
_Avoid_: Join URL, invitation

**Budget**:
The single gift price range (min–max, one currency) the Organizer sets for the Group. Informational, not enforced.
_Avoid_: Limit, spending cap

**Joining Closed**:
The state after the Organizer closes membership; no new Members can join.
_Avoid_: Locked, frozen

**Draw**:
The random assignment of every Member to exactly one receiver, where nobody draws themselves.
_Avoid_: Shuffle, raffle, matching

**Assignment**:
The result for one Member: the receiver they give a gift to. Visible only to that Member, never the Organizer.
_Avoid_: Pairing, match

**Santa**:
The Member giving a gift to a given receiver, anonymous to that receiver.
_Avoid_: Giver (in UI)

**Exclusion**:
An Organizer-defined pair of Members who cannot draw each other.
_Avoid_: Blocklist, restriction

**Re-draw**:
A new Draw replacing the previous one before the Exchange Date; notifies all Members.
_Avoid_: Reshuffle, reroll

**Exchange Date**:
The date on which gifts are exchanged.
_Avoid_: Gift day, reveal date
