// Book type

export interface Book {
    _id: string;
    title: string;
    author_names: string[];
    cover_id: number;
    first_publish_year: number;
    cover_edition_key: string;
    ratings_average?: number;
    ratings_count?: number;
}
