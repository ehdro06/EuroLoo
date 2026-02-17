'use client';

import { useGetAllUsersQuery, useGetHiddenToiletsQuery, useRestoreToiletMutation, useDeleteToiletMutation, useUpdateUserRoleMutation } from '@/lib/services/api';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Basic role check (Frontend) - Backend enforces it strictly
  // We assume admin users have public metadata or we fetch /users/me
  const isAdmin = user?.publicMetadata?.role === 'admin' || true; // MVP: strict check on backend, loose on frontend for now

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/');
    }
  }, [isLoaded, user, router]);

  const { data: hiddenToilets, isLoading: isLoadingToilets } = useGetHiddenToiletsQuery(undefined, {
    skip: !isAdmin,
  });

  const { data: users, isLoading: isLoadingUsers } = useGetAllUsersQuery(undefined, {
    skip: !isAdmin,
  });

  const [restoreToilet] = useRestoreToiletMutation();
  const [deleteToilet] = useDeleteToiletMutation();
  const [updateUserRole] = useUpdateUserRoleMutation();

  const handleRestore = async (id: number) => {
    try {
      await restoreToilet(id).unwrap();
      toast.success('Toilet restored');
    } catch (err) {
      toast.error('Failed to restore toilet');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this toilet?')) return;
    try {
      await deleteToilet(id).unwrap();
      toast.success('Toilet deleted');
    } catch (err) {
      toast.error('Failed to delete toilet');
    }
  };
  
  const handleRoleChange = async (clerkId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!confirm(`Change role to ${newRole}?`)) return;
    
    try {
        await updateUserRole({ clerkId, role: newRole }).unwrap();
        toast.success(`User role updated to ${newRole}`);
    } catch (err) {
        toast.error('Failed to update role');
    }
  };

  if (!isLoaded) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <Tabs defaultValue="toilets" className="w-full">
        <TabsList>
          <TabsTrigger value="toilets">Hidden Toilets ({hiddenToilets?.length || 0})</TabsTrigger>
          <TabsTrigger value="users">Users ({users?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="toilets">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingToilets ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : hiddenToilets?.map((toilet) => (
                  <TableRow key={toilet.id}>
                    <TableCell>{toilet.id}</TableCell>
                    <TableCell>{toilet.name || 'Unnamed'}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        Reports: {toilet.reportCount} / Verifies: {toilet.verifyCount}
                      </Badge>
                    </TableCell>
                    <TableCell>{toilet.lat.toFixed(4)}, {toilet.lon.toFixed(4)}</TableCell>
                    <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(toilet.id)}>Restore</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(toilet.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoadingToilets && hiddenToilets?.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No hidden toilets found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                      <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : users?.map((user) => (
                  <TableRow key={user.clerkId}>
                    <TableCell>{user.username || 'Unknown'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                            {user.role}
                        </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(user.createdAt), 'yyyy-MM-dd')}</TableCell>
                    <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleRoleChange(user.clerkId, user.role)}>
                            Toggle Role
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
