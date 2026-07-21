import { cookies } from 'next/headers';

export async function checkAuth() {
    const cookieStore = await cookies();
    const sid = cookieStore.get('sid');
    return !!sid?.value;
}
