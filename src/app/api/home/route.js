import { NextResponse } from 'next/server';

export async function GET(request) {
    return NextResponse.json({ name: 'nickish' }, { status: 200 });
}
