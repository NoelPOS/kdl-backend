import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(TeacherEntity)
    private teacherRepository: Repository<TeacherEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const { sub, email, role } = payload;

    let user;
    if (role === UserRole.TEACHER) {
      user = await this.teacherRepository.findOne({ where: { id: sub } });
    } else {
      user = await this.userRepository.findOne({ where: { id: sub } });
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: sub,
      email: email,
      name: user.name || user.userName,
      role: role,
    };
  }
}
