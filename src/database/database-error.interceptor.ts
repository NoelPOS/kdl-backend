import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry, retryWhen, delayWhen } from 'rxjs/operators';

/**
 * Database Error Interceptor
 * Handles connection errors and implements intelligent retry logic
 * Specifically targets "Connection terminated unexpectedly" errors
 */
@Injectable()
export class DatabaseErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DatabaseErrorInterceptor.name);
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Check if it's a connection-related error
        if (this.isConnectionError(error)) {
          this.logger.warn(
            `Database connection error detected: ${error.message}. Attempting retry ${this.retryCount + 1}/${this.maxRetries}`,
          );

          // Increment retry count
          this.retryCount++;

          // If we haven't exceeded max retries, retry with delay
          if (this.retryCount <= this.maxRetries) {
            return timer(this.retryDelay * this.retryCount).pipe(
              // Reset retry count on success
              catchError(() => {
                this.retryCount = 0;
                return next.handle();
              }),
            );
          } else {
            // Reset retry count and throw original error
            this.retryCount = 0;
            this.logger.error(
              `Max retries (${this.maxRetries}) exceeded for database connection. Original error: ${error.message}`,
            );
          }
        }

        // Reset retry count for non-connection errors
        this.retryCount = 0;
        return throwError(() => error);
      }),

      // Alternative retry strategy using retryWhen
      retryWhen((errors) =>
        errors.pipe(
          delayWhen((error, index) => {
            if (this.isConnectionError(error) && index < this.maxRetries) {
              const delay = this.retryDelay * (index + 1);
              this.logger.warn(
                `Retrying database operation in ${delay}ms (attempt ${index + 1}/${this.maxRetries})`,
              );
              return timer(delay);
            }
            // Don't retry if max attempts reached or not a connection error
            return throwError(() => error);
          }),
        ),
      ),
    );
  }

  /**
   * Determines if an error is connection-related
   */
  private isConnectionError(error: any): boolean {
    const connectionErrorMessages = [
      'Connection terminated unexpectedly',
      'Connection terminated due to connection timeout',
      'connection timeout',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Connection ended unexpectedly',
      'Connection lost',
      'server closed the connection unexpectedly',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code?.toLowerCase() || '';

    return (
      connectionErrorMessages.some((msg) =>
        errorMessage.includes(msg.toLowerCase()),
      ) || ['econnreset', 'enotfound', 'etimedout'].includes(errorCode)
    );
  }
}
