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
  isVerified?: boolean;
  reportCount?: number;
  verifyCount?: number;
  isHidden?: boolean;
}

export interface User {
    id: number;
    email: string | null;
    username: string | null;
    role: 'USER' | 'ADMIN';
    clerkId: string;
    createdAt: string;
}

export interface Author {
    id: number;
    username: string | null;
    clerkId: string;
}

export interface ImageRecord {
  id: number;
  url: string;
  createdAt: string;
  user?: { username: string | null };
}

export interface Review {
  id: number;
  content: string;
  rating: number;
  createdAt: string;
  toiletId: number;
  author?: Author;
}

export interface AddToiletRequest {
  lat: number;
  lng: number;
  userLat: number;
  userLng: number;
  name?: string;
  operator?: string;
  fee?: string;
  isFree?: boolean;
  isPaid?: boolean;
  openingHours?: string;
  wheelchair?: string;
  isAccessible?: boolean;
}

// Clerk exposes the active session on `window.Clerk` once loaded.
type ClerkWindow = Window & { Clerk?: { session?: { getToken: () => Promise<string | null> } | null } };

interface AddReviewRequest {
  externalId: string;
  content: string;
  rating: number;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    prepareHeaders: async (headers) => {
      const session = typeof window !== 'undefined' ? (window as ClerkWindow).Clerk?.session : undefined;
      if (session) {
        try {
          const token = await session.getToken();
          if (token) {
            headers.set('Authorization', `Bearer ${token}`);
          }
        } catch (e) {
          console.error('Failed to get Clerk token', e);
        }
      }
      return headers;
    },
  }),
  tagTypes: ['Reviews', 'Toilets', 'HiddenToilets', 'Users', 'Images'],
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
    reportToilet: builder.mutation<Toilet, number>({
      query: (id) => ({
        url: `/api/toilets/${id}/report`,
        method: 'POST',
      }),
      invalidatesTags: ['Toilets'],
    }),
    verifyToilet: builder.mutation<Toilet, number>({
      query: (id) => ({
        url: `/api/toilets/${id}/verify`,
        method: 'POST',
      }),
      invalidatesTags: ['Toilets'],
    }),
    addToilet: builder.mutation<Toilet, AddToiletRequest>({
      query: (body) => ({
        url: '/api/toilets',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Toilets'],
    }),
    
    // --- Images ---
    getToiletImages: builder.query<ImageRecord[], number>({
      query: (toiletId) => `/api/toilets/${toiletId}/images`,
      providesTags: (result, error, toiletId) => [{ type: 'Images', id: toiletId }],
    }),
    getPresignedUrl: builder.mutation<{ uploadUrl: string; fileUrl: string }, { contentType: string; extension: string }>({
      query: (body) => ({
        url: '/images/presigned-url',
        method: 'POST',
        body,
      }),
    }),
    confirmImageUpload: builder.mutation<ImageRecord, { toiletId: number; fileUrl: string }>({
      query: (body) => ({
        url: '/images/confirm',
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { toiletId }) => [{ type: 'Images', id: toiletId }],
    }),
    
    // --- Admin Endpoints ---
    getHiddenToilets: builder.query<Toilet[], void>({
      query: () => '/api/toilets/hidden',
      providesTags: ['HiddenToilets'],
    }),
    restoreToilet: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/toilets/${id}/restore`,
        method: 'POST',
      }),
      invalidatesTags: ['HiddenToilets', 'Toilets'],
    }),
    deleteToilet: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/toilets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['HiddenToilets', 'Toilets'],
    }),
    getAllUsers: builder.query<User[], void>({
      query: () => '/users',
      providesTags: ['Users'],
    }),
    updateUserRole: builder.mutation<User, { clerkId: string; role: 'USER' | 'ADMIN' }>({
      query: ({ clerkId, role }) => ({
        url: `/users/${clerkId}/role`,
        method: 'POST',
        body: { role },
      }),
      invalidatesTags: ['Users'],
    }),
  }),
});

export const { 
    useGetToiletsQuery, 
    useAddReviewMutation, 
    useGetReviewsQuery, 
    useGetReviewsByToiletQuery, 
    useAddToiletMutation,
    useReportToiletMutation,
    useVerifyToiletMutation,
    useGetHiddenToiletsQuery,
    useRestoreToiletMutation,
    useDeleteToiletMutation,
    useGetAllUsersQuery,
    useUpdateUserRoleMutation,
    useGetToiletImagesQuery,
    useGetPresignedUrlMutation,
    useConfirmImageUploadMutation
} = api;
