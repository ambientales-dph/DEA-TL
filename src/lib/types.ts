export interface Member {
  id: string;
  username: string;
  avatarUrl: string;
  fullName: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Card {
  id: string;
  name: string;
  desc: string;
  idMembers: string[];
  labels: Label[];
}

export interface List {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  desc: string;
  lists: List[];
  members: Member[];
}
