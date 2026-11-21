# Sahara Santa

A web app where people sign in, join a Group, and are randomly assigned someone to give a gift to anonymously.

## Language

### People and groups

**Group**:
One Secret Santa event with its own Members, Budget, Exchange Date, and Draw.
_Avoid_: Event, party, room, circle

**Organizer**:
The Member who created a Group and controls its rules, joining, and Draw. Participates as a Member by default.
_Avoid_: Host, admin, owner

**Member**:
A verified, signed-in person who has joined a Group and takes part as a Santa and as a receiver.
_Avoid_: Participant, player, user

**Invite Link**:
A shareable link (with short code) that lets a Member-to-be join an open Group. Can be reset by the Organizer.
_Avoid_: Join URL, invitation

**Joining Closed**:
The state after the Organizer closes membership; no new Members can join.
_Avoid_: Locked, frozen

**Archived**:
The read-only state of a Group 30 days after its Exchange Date.
_Avoid_: Finished, expired

### Profile

**Profile**:
A person's identity across all Groups: display name, Profile Picture, Bio, and Song.
_Avoid_: Account (that is the sign-in, not the identity)

**Profile Picture**:
The person's image, cropped square and shown as a circle. Optional; defaults to initials.
_Avoid_: Avatar, photo

**Bio**:
A short plain-text description on the Profile, up to 150 characters.
_Avoid_: About, description

**Song**:
A track the person picks on their Profile. Only their Santa hears it, and only after the Draw.
_Avoid_: Anthem, theme song

**Override**:
A Group-specific replacement of a Member's Profile Picture or Bio by the Organizer, leaving the Profile itself unchanged.
_Avoid_: Edit, moderation

### Gifting

**Budget**:
The single gift price range (min–max, one currency) the Organizer sets for the Group. Informational, not enforced.
_Avoid_: Limit, spending cap

**Exchange Date**:
The date on which gifts are exchanged.
_Avoid_: Gift day, reveal date

**Exclusion**:
An Organizer-defined pair of Members who cannot be each other's Santa or receiver.
_Avoid_: Blocklist, restriction

**Draw**:
The random assignment that links all Members into one loop, so each Member has exactly one receiver and one Santa, and nobody draws themselves.
_Avoid_: Shuffle, raffle, matching

**Assignment**:
The result for one Member: the receiver they give a gift to. Visible only to that Member, never the Organizer.
_Avoid_: Pairing, match

**Santa**:
The Member giving a gift to a given receiver, anonymous to that receiver.
_Avoid_: Giver (in UI)

**Reveal**:
The moment a Member opens their Assignment and sees their receiver's Profile.
_Avoid_: Unwrap, open

**Re-draw**:
A new Draw replacing the previous one before the Exchange Date.
_Avoid_: Reshuffle, reroll

**Patch**:
Closing the gap in the loop when a Member leaves or is removed after the Draw: their Santa takes over their receiver.
_Avoid_: Re-splice, reassign
