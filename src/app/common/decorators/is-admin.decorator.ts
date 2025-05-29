import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IsAdmin = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user; // Assuming you have the user object attached to the request
    console.log('User:', user);
    // Check if the user is an admin or has isAdmin = true
    return user.role === 'admin' || user.isAdmin === true;
  },
);
