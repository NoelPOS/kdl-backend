import { Module } from '@nestjs/common';
import { HashService } from './services/hash.service';
import { CommonModule } from '../../common/common.module';

@Module({
    imports: [CommonModule],
    providers: [HashService],
    exports: [HashService, CommonModule],
})
export class SharedModule { }