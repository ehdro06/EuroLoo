import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface Toilet {
  id: number;
  externalId: string;
  lat: number;
  lon: number;
  name?: string;
  operator?: string;
  fee?: string;
  isFree: boolean;
  isPaid: boolean;
  openingHours?: string;
  wheelchair?: string;
  isAccessible: boolean;
}

export interface Review {
  id: number;
  content: string;
  rating: number;
  createdAt: string;
  toiletId: number;
}

interface AddReviewRequest {
  externalId: string;
  content: string;
  rating: number;
  // Extras based on UI requirements that might need to go into content or structured data
  // The server DTO only accepts content and rating and externalId.
  // We'll pack the extras into the content for now, or assume the server needs update.
  // Wait, the user asked for: Cleanliness, Price (Fee), Comment.
  // The server DTO has: content, rating.
  // I will concatenate the extra fields into the content string for MVP as "Review: ... | Cleanliness: ... | Price: ...".
  // OR just start with what the server supports. The prompt says "UI Requirements".
  // I should probably conform to the server API or extend it.
  // Since I am only editing the client now, I will format the 'content' field to include the extra data.
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000' }),
  tagTypes: ['Reviews', 'Toilets'],
  endpoints: (builder) => ({
    getToilets: builder.query<Toilet[], { lat: number; lng: number; radius?: number }>({
      query: ({ lat, lng, radius }) => ({
        url: `/api/toilets`, // Matches server controller @Get('toilets') under @Controller('api')
        params: { lat, lng, radius },
      }),
      providesTags: ['Toilets'],
    }),
    addReview: builder.mutation<Review, AddReviewRequest>({
      query: (body) => ({
        url: '/reviews',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Reviews'],
    }),
    getReviews: builder.query<Review[], void>({
       query: () => '/reviews',
       providesTags: ['Reviews']
    }),
    getReviewsByToilet: builder.query<Review[], string>({
      query: (externalId) => `/reviews/toilet/${encodeURIComponent(externalId)}`,
      providesTags: (result, error, externalId) => [{ type: 'Reviews', id: externalId }],
    }),
    addToilet: builder.mutation<Toilet, any>({
      query: (body) => ({
        url: '/api/toilets',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Toilets'],
    }),
  }),
});

export const { useGetToiletsQuery, useAddReviewMutation, useGetReviewsQuery, useGetReviewsByToiletQuery, useAddToiletMutation } = api;
