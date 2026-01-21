import type { Board, Member } from './types';

export const mockMembers: Member[] = [
  {
    id: '1',
    username: 'alice',
    fullName: 'Alice Johnson',
    avatarUrl: 'https://picsum.photos/seed/user1/40/40',
  },
  {
    id: '2',
    username: 'bob',
    fullName: 'Bob Williams',
    avatarUrl: 'https://picsum.photos/seed/user2/40/40',
  },
  {
    id: '3',
    username: 'charlie',
    fullName: 'Charlie Brown',
    avatarUrl: 'https://picsum.photos/seed/user3/40/40',
  },
];

export const mockBoards: Board[] = [
  {
    id: 'board-1',
    name: 'Project Phoenix',
    desc: 'A complete overhaul of the user authentication and dashboard experience. Focus on performance, security, and a modern UI.',
    members: mockMembers,
    lists: [
      {
        id: 'list-1',
        name: 'To Do',
        cards: [
          {
            id: 'card-1',
            name: 'Design new login page',
            desc: '',
            idMembers: ['1'],
            labels: [{ id: 'label-1', name: 'Design', color: 'blue' }],
          },
          {
            id: 'card-2',
            name: 'Setup Firebase Authentication',
            desc: '',
            idMembers: ['2'],
            labels: [{ id: 'label-2', name: 'Backend', color: 'green' }],
          },
        ],
      },
      {
        id: 'list-2',
        name: 'In Progress',
        cards: [
          {
            id: 'card-3',
            name: 'Develop dashboard sidebar component',
            desc: 'The sidebar needs to be responsive and show a list of user boards.',
            idMembers: ['1', '3'],
            labels: [{ id: 'label-3', name: 'Frontend', color: 'purple' }],
          },
        ],
      },
      {
        id: 'list-3',
        name: 'Done',
        cards: [
          {
            id: 'card-4',
            name: 'Project setup and dependency installation',
            desc: '',
            idMembers: ['2'],
            labels: [{ id: 'label-4', name: 'Chore', color: 'gray' }],
          },
        ],
      },
    ],
  },
  {
    id: 'board-2',
    name: 'Marketing Campaign Q3',
    desc: 'Planning and execution of all marketing activities for the third quarter. Includes social media, content marketing, and email campaigns.',
    members: [mockMembers[0], mockMembers[2]],
    lists: [
      {
        id: 'list-4',
        name: 'Ideation',
        cards: [
          {
            id: 'card-5',
            name: 'Brainstorm blog post topics',
            desc: '',
            idMembers: ['3'],
            labels: [],
          },
        ],
      },
      {
        id: 'list-5',
        name: 'Executing',
        cards: [],
      },
    ],
  },
];

export function getBoardById(id: string): Board | undefined {
  return mockBoards.find((board) => board.id === id);
}
