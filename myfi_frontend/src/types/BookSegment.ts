import { Book } from './Book';

export type SegmentType = 
  | 'CURRENTLY_READING'
  | 'BECAUSE_YOU_READ'
  | 'RECOMMENDED_FOR_YOU'
  | 'TRENDING_SCIFI'
  | 'TRENDING_FANTASY'
  | 'EPIC_SAGAS'
  | 'PRE_2000'
  | 'POST_2000'
  | 'MY_LIST';

export interface BookSegment {
  id: string;
  title: string;
  type: SegmentType;
  books: Book[];
  priority: number; // For ordering segments
  isPersonalized?: boolean;
  sourceBook?: Book; // For "Because You Read X" segments
}
