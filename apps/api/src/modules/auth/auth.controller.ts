import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Endpoint: POST /auth/register
  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') passwordPlain: string,
    @Body('name') name?: string,
  ) {
    return this.authService.register(email, passwordPlain, name);
  }

  // Endpoint: POST /auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('email') email: string,
    @Body('password') passwordPlain: string,
  ) {
    return this.authService.login(email, passwordPlain);
  }
}
