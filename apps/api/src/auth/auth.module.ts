import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EntraService } from './entra.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { TokenService } from './token.service';
import { UserAccessService } from './user-access.service';
import { ObjectAccessService } from './object-access.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, UserAccessService, ObjectAccessService, EntraService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, TokenService, UserAccessService, ObjectAccessService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
